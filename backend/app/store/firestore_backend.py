"""Firestore persistence.

The primary store when Firebase credentials are configured. Mirrors the SqliteStore
interface exactly so the API layer never branches on which backend is live.

Collection layout (project: whatever FIREBASE_PROJECT_ID names):

    users/{uid}                        → User record
    users/{uid}/profile/main           → Profile record
    users/{uid}/history/{entry_id}     → HistoryEntry (full run payload)
    users/{uid}/saved/{finding_id}     → { created_at }
    users/{uid}/tracked/{term_hash}    → { term, created_at }
    email_index/{email}                → { uid }

History and the per-user collections are nested under the owning user document, so
a query can never accidentally return another account's data — the path itself is
the tenancy boundary rather than a `where uid ==` clause someone can forget.

`email_index` exists because Firestore has no unique constraint. Writing the index
document with `create()` fails if the key is taken, which is what actually makes
registration atomic under a concurrent double-submit.
"""

from __future__ import annotations

import hashlib
from typing import Any

from ..config import settings
from .models import HistoryEntry, Profile, User, utc_now


def _term_key(term: str) -> str:
    """Firestore document ids cannot contain '/' and are length-limited."""
    return hashlib.sha1(term.strip().lower().encode()).hexdigest()[:24]


def _email_key(email: str) -> str:
    return hashlib.sha1(email.strip().lower().encode()).hexdigest()[:32]


class FirestoreStore:
    """Repository over Cloud Firestore."""

    backend = "firestore"

    def __init__(self, client: Any) -> None:
        self._db = client

    # ── users ────────────────────────────────────────────────
    def _users(self):
        return self._db.collection("users")

    def get_user(self, uid: str) -> User | None:
        snap = self._users().document(uid).get()
        return User.from_record(snap.to_dict()) if snap.exists else None

    def get_user_by_email(self, email: str) -> User | None:
        idx = self._db.collection("email_index").document(_email_key(email)).get()
        if not idx.exists:
            return None
        uid = (idx.to_dict() or {}).get("uid")
        return self.get_user(uid) if uid else None

    def create_user(self, user: User) -> User:
        email = user.email.strip().lower()
        user.email = email
        # create() raises AlreadyExists if the email is taken — the atomic guard.
        self._db.collection("email_index").document(_email_key(email)).create(
            {"uid": user.uid, "email": email, "created_at": utc_now()}
        )
        self._users().document(user.uid).set(user.to_record())
        return user

    def update_user(self, uid: str, **fields: Any) -> None:
        if not fields:
            return
        self._users().document(uid).update(fields)

    def count_users(self) -> int:
        # count() avoids streaming every document just to size the collection.
        agg = self._users().count().get()
        try:
            return int(agg[0][0].value)
        except (IndexError, AttributeError, TypeError):  # pragma: no cover
            return 0

    # ── profiles ─────────────────────────────────────────────
    def _profile_doc(self, uid: str):
        return self._users().document(uid).collection("profile").document("main")

    def get_profile(self, uid: str) -> Profile | None:
        snap = self._profile_doc(uid).get()
        return Profile.from_record(snap.to_dict()) if snap.exists else None

    def save_profile(self, profile: Profile) -> Profile:
        profile.updated_at = utc_now()
        self._profile_doc(profile.uid).set(profile.to_record())
        return profile

    # ── history ──────────────────────────────────────────────
    def _history(self, uid: str):
        return self._users().document(uid).collection("history")

    def add_history(self, entry: HistoryEntry, *, retain: int) -> HistoryEntry:
        self._history(entry.uid).document(entry.entry_id).set(entry.to_record())
        if retain > 0:
            # Only ids and timestamps are needed to decide what to trim, so this
            # deliberately avoids pulling the full run payloads back down.
            docs = (
                self._history(entry.uid)
                .order_by("created_at", direction="DESCENDING")
                .offset(retain)
                .select([])
                .stream()
            )
            for doc in docs:
                doc.reference.delete()
        return entry

    def list_history(self, uid: str, *, limit: int = 50) -> list[HistoryEntry]:
        docs = (
            self._history(uid)
            .order_by("created_at", direction="DESCENDING")
            .limit(limit)
            # The full result payload is large and unused by the list view.
            .select(["entry_id", "uid", "run_id", "goal", "created_at", "summary"])
            .stream()
        )
        return [HistoryEntry.from_record(d.to_dict() or {}) for d in docs]

    def get_history(self, uid: str, entry_id: str) -> HistoryEntry | None:
        snap = self._history(uid).document(entry_id).get()
        return HistoryEntry.from_record(snap.to_dict()) if snap.exists else None

    def delete_history(self, uid: str, entry_id: str) -> bool:
        ref = self._history(uid).document(entry_id)
        if not ref.get().exists:
            return False
        ref.delete()
        return True

    # ── saved / tracked ──────────────────────────────────────
    def _saved(self, uid: str):
        return self._users().document(uid).collection("saved")

    def list_saved(self, uid: str) -> list[str]:
        return [d.id for d in self._saved(uid).select([]).stream()]

    def toggle_saved(self, uid: str, finding_id: str) -> bool:
        ref = self._saved(uid).document(finding_id)
        if ref.get().exists:
            ref.delete()
            return False
        ref.set({"created_at": utc_now()})
        return True

    def _tracked(self, uid: str):
        return self._users().document(uid).collection("tracked")

    def list_tracked(self, uid: str) -> list[str]:
        return [
            (d.to_dict() or {}).get("term", "")
            for d in self._tracked(uid).stream()
            if (d.to_dict() or {}).get("term")
        ]

    def add_tracked(self, uid: str, term: str) -> list[str]:
        self._tracked(uid).document(_term_key(term)).set(
            {"term": term, "created_at": utc_now()}
        )
        return self.list_tracked(uid)

    def remove_tracked(self, uid: str, term: str) -> list[str]:
        self._tracked(uid).document(_term_key(term)).delete()
        return self.list_tracked(uid)

    def health(self) -> dict[str, Any]:
        try:
            return {
                "backend": "firestore",
                "ok": True,
                "project": settings.firebase_project_id or None,
                "users": self.count_users(),
            }
        except Exception as exc:
            return {"backend": "firestore", "ok": False, "error": str(exc)}
