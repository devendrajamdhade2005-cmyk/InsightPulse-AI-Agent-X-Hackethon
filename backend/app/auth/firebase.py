"""Firebase identity integration.

Three distinct capabilities, and it matters which is which:

  1. **ID-token verification** — Admin SDK, offline after key fetch. Lets a client
     that already signed in with the Firebase Web SDK (including Google sign-in)
     present its ID token to us.
  2. **User record management** — Admin SDK. Create, look up, disable, set a
     password.
  3. **Password verification** — NOT in the Admin SDK. There is no
     `auth.verify_password()`. It only exists in the Identity Toolkit REST API,
     which is keyed by the project's Web API key.

That third point is why `FIREBASE_WEB_API_KEY` is required for email/password
sign-in, and why the service falls back to locally-hashed passwords without it.
Every function here degrades to a clear error instead of raising an opaque one, so
the API layer can report the real reason.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from ..config import settings
from ..store import firebase_app

log = logging.getLogger(__name__)

_IDENTITY_BASE = "https://identitytoolkit.googleapis.com/v1/accounts"
_TIMEOUT = 12.0


class FirebaseUnavailable(Exception):
    """Firebase is not configured, or the call could not be completed."""


class FirebaseAuthError(Exception):
    """Firebase answered, and the answer was a rejection."""


# Identity Toolkit error codes → messages that do not leak account existence.
_FRIENDLY = {
    "EMAIL_NOT_FOUND": "Incorrect email or password.",
    "INVALID_PASSWORD": "Incorrect email or password.",
    "INVALID_LOGIN_CREDENTIALS": "Incorrect email or password.",
    "USER_DISABLED": "This account has been disabled.",
    "EMAIL_EXISTS": "An account with this email already exists.",
    "WEAK_PASSWORD": "Password is too weak.",
    "TOO_MANY_ATTEMPTS_TRY_LATER": "Too many attempts. Please try again later.",
    "OPERATION_NOT_ALLOWED": (
        "Email/password sign-in is disabled for this Firebase project. Enable it "
        "under Authentication → Sign-in method."
    ),
}


def _auth_module() -> Any:
    if not settings.firebase_configured:
        raise FirebaseUnavailable("Firebase Admin credentials are not configured.")
    from firebase_admin import auth

    firebase_app()  # ensure initialised
    return auth


# ── 1. ID-token verification ─────────────────────────────────


def verify_id_token(token: str) -> dict[str, Any]:
    """Verify a Firebase ID token. Returns the decoded claims."""
    auth = _auth_module()
    try:
        # check_revoked would add a network round trip per request; sign-out is
        # handled by our own short-lived session token instead.
        return auth.verify_id_token(token)
    except Exception as exc:
        raise FirebaseAuthError(f"Firebase ID token rejected: {exc}") from exc


# ── 2. user record management ───────────────────────────────


def create_firebase_user(email: str, password: str, display_name: str = "") -> str:
    """Create the Firebase Auth record. Returns the Firebase uid."""
    auth = _auth_module()
    try:
        record = auth.create_user(
            email=email,
            password=password,
            display_name=display_name or None,
        )
        return record.uid
    except Exception as exc:
        code = getattr(exc, "code", "") or type(exc).__name__
        if "EMAIL_EXISTS" in str(exc).upper() or "already exists" in str(exc).lower():
            raise FirebaseAuthError(_FRIENDLY["EMAIL_EXISTS"]) from exc
        raise FirebaseAuthError(f"Could not create the Firebase user ({code}).") from exc


def get_firebase_user_by_email(email: str) -> Any | None:
    auth = _auth_module()
    try:
        return auth.get_user_by_email(email)
    except Exception:
        return None


def set_firebase_password(firebase_uid: str, password: str) -> None:
    auth = _auth_module()
    try:
        auth.update_user(firebase_uid, password=password)
    except Exception as exc:
        raise FirebaseAuthError(f"Could not update the password: {exc}") from exc


# ── 3. password verification (Identity Toolkit REST) ─────────


def _web_key() -> str:
    key = (settings.firebase_web_api_key or "").strip()
    if not key:
        raise FirebaseUnavailable(
            "FIREBASE_WEB_API_KEY is not set, so Firebase cannot verify a password."
        )
    return key


def _identity_call(endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{_IDENTITY_BASE}:{endpoint}?key={_web_key()}"
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            res = client.post(url, json=payload)
    except httpx.HTTPError as exc:
        raise FirebaseUnavailable(f"Could not reach Firebase: {exc}") from exc

    body: dict[str, Any]
    try:
        body = res.json()
    except ValueError:
        body = {}

    if res.status_code >= 400:
        code = str(((body.get("error") or {}).get("message") or "")).split(" ")[0]
        raise FirebaseAuthError(_FRIENDLY.get(code, f"Firebase rejected the request ({code or res.status_code})."))
    return body


def verify_password_with_firebase(email: str, password: str) -> dict[str, Any]:
    """Sign in against Firebase. Returns the Identity Toolkit response."""
    return _identity_call(
        "signInWithPassword",
        {"email": email, "password": password, "returnSecureToken": True},
    )


def send_password_reset(email: str) -> None:
    """Ask Firebase to email a reset link.

    Errors are swallowed on purpose: the endpoint that calls this always answers
    "if that address exists, a link is on the way", so a failure here must not
    reveal whether the address is registered.
    """
    try:
        _identity_call("sendOobCode", {"requestType": "PASSWORD_RESET", "email": email})
    except (FirebaseAuthError, FirebaseUnavailable) as exc:
        log.info("Password reset for a non-existent or unreachable account: %s", exc)


def status() -> dict[str, Any]:
    """Safe status for /health."""
    configured = settings.firebase_configured
    report: dict[str, Any] = {
        "admin_sdk": configured,
        "project": settings.firebase_project_id or None,
        "web_api_key_set": bool((settings.firebase_web_api_key or "").strip()),
        "password_verification": settings.password_auth_mode,
    }
    if configured:
        try:
            firebase_app()
            report["initialised"] = True
        except Exception as exc:
            report["initialised"] = False
            report["error"] = f"{type(exc).__name__}: {exc}"
    return report
