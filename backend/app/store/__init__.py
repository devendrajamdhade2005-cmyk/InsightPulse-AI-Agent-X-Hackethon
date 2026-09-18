"""Persistence selector.

Firestore is used when Firebase credentials are configured; otherwise SQLite. The
choice is made once, lazily, and the outcome is reported rather than hidden.

The degradation rule follows the pattern already used for LLM and source providers
in this project: if the preferred backend cannot be reached, fall back to one that
works and say so explicitly. Silently running on SQLite while the operator believes
they are writing to Firestore would be the worst outcome here, because it looks
exactly like success until the data is missing from the console.
"""

from __future__ import annotations

import json
import logging
import threading
from typing import Any

from ..config import settings
from .models import HistoryEntry, Profile, User, new_id, summarise_run, utc_now
from .sqlite_backend import SqliteStore

log = logging.getLogger(__name__)

_store: Any | None = None
_lock = threading.Lock()
_degraded: str = ""

__all__ = [
    "HistoryEntry",
    "Profile",
    "User",
    "get_store",
    "new_id",
    "reset_store",
    "store_report",
    "summarise_run",
    "utc_now",
]


def _firebase_credential() -> Any:
    """Build an Admin SDK credential from a file path or inline JSON."""
    from firebase_admin import credentials  # imported lazily: optional dependency

    inline = (settings.firebase_credentials_json or "").strip()
    if inline:
        return credentials.Certificate(json.loads(inline))
    path = settings.firebase_credentials_path()
    if path:
        return credentials.Certificate(str(path))
    raise RuntimeError("no Firebase credentials configured")


def firebase_app() -> Any:
    """Initialise (once) and return the Firebase Admin app.

    Raises if Firebase is not configured or the credential is unusable. Callers are
    expected to handle that and degrade.
    """
    import firebase_admin

    try:
        return firebase_admin.get_app()
    except ValueError:
        pass  # not initialised yet

    options: dict[str, Any] = {}
    if settings.firebase_project_id:
        options["projectId"] = settings.firebase_project_id
    return firebase_admin.initialize_app(_firebase_credential(), options or None)


def _build_firestore() -> Any:
    from firebase_admin import firestore

    app = firebase_app()
    client = firestore.client(app)
    from .firestore_backend import FirestoreStore

    store = FirestoreStore(client)
    # Prove the connection now rather than on the first user's registration. A
    # credential that parses but cannot reach the project would otherwise surface as
    # a failed signup instead of a startup problem.
    health = store.health()
    if not health.get("ok"):
        raise RuntimeError(health.get("error") or "Firestore health check failed")
    return store


def get_store() -> Any:
    """The active repository. Same interface regardless of backend."""
    global _store, _degraded
    if _store is not None:
        return _store
    with _lock:
        if _store is not None:
            return _store

        if settings.firestore_enabled and settings.firebase_configured:
            try:
                _store = _build_firestore()
                _degraded = ""
                log.info("Persistence: Firestore (project=%s)", settings.firebase_project_id)
                return _store
            except Exception as exc:
                _degraded = (
                    f"Firestore was requested but could not be initialised "
                    f"({type(exc).__name__}: {exc}). Falling back to local SQLite — "
                    f"data written now will NOT appear in the Firebase console."
                )
                log.warning("Persistence: %s", _degraded)
        elif settings.firestore_enabled and not settings.firebase_configured:
            _degraded = (
                "FIRESTORE_ENABLED is true but no usable Firebase credential was "
                "found, so the local SQLite store is in use."
            )
            log.warning("Persistence: %s", _degraded)

        _store = SqliteStore()
        return _store


def reset_store() -> None:
    """Drop the cached store. Used between tests."""
    global _store, _degraded
    with _lock:
        _store = None
        _degraded = ""


def store_report() -> dict[str, Any]:
    """Safe status for /health. Never includes a credential."""
    store = get_store()
    report = {"backend": getattr(store, "backend", "unknown")}
    try:
        report.update(store.health())
    except Exception as exc:  # pragma: no cover - defensive
        report.update({"ok": False, "error": str(exc)})
    if _degraded:
        report["degraded"] = _degraded
    return report
