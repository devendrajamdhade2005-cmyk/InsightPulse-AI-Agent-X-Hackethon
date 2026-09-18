"""Registration and sign-in.

One place decides *how* a credential is checked, so the API layer and the frontend
never need to know which backend is active:

    FIREBASE_WEB_API_KEY set  → Firebase Identity Toolkit verifies the password
    otherwise                 → a local bcrypt hash verifies it

Either way a user record exists in our own store and we issue our own session
token. That is what makes the Firebase path a configuration change rather than a
migration: enabling it later does not alter the token the frontend holds, the
endpoints it calls, or the shape of the profile it reads.
"""

from __future__ import annotations

import logging
from typing import Any

from ..config import settings
from ..store import Profile, User, get_store, new_id, utc_now
from . import firebase
from .passwords import dummy_verify, hash_password, validate_password, verify_password

log = logging.getLogger(__name__)


class AuthError(Exception):
    """Authentication or registration failed for a reason safe to show a user."""

    def __init__(self, message: str, status_code: int = 401) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def normalise_email(email: str) -> str:
    return (email or "").strip().lower()


def _ensure_profile(user: User) -> Profile:
    store = get_store()
    existing = store.get_profile(user.uid)
    if existing:
        return existing
    return store.save_profile(
        Profile(uid=user.uid, display_name=user.display_name or "")
    )


# ── registration ─────────────────────────────────────────────


def register(email: str, password: str, display_name: str = "") -> tuple[User, Profile]:
    if not settings.allow_registration:
        raise AuthError("Registration is closed on this deployment.", 403)

    email = normalise_email(email)
    if not email or "@" not in email:
        raise AuthError("Enter a valid email address.", 422)

    problem = validate_password(password)
    if problem:
        raise AuthError(problem, 422)

    store = get_store()
    if store.get_user_by_email(email):
        raise AuthError("An account with this email already exists.", 409)

    firebase_uid = ""
    if settings.password_auth_mode == "firebase":
        # Firebase owns the credential in this mode, so create it there first. If
        # this fails we must not create a local account, or the user would exist
        # with no way to authenticate.
        try:
            firebase_uid = firebase.create_firebase_user(email, password, display_name)
        except firebase.FirebaseAuthError as exc:
            raise AuthError(str(exc), 409) from exc
        except firebase.FirebaseUnavailable as exc:
            raise AuthError(
                f"Identity provider unavailable: {exc}", 503
            ) from exc

    user = User(
        uid=new_id("usr"),
        email=email,
        display_name=(display_name or "").strip()[:200],
        # A local hash is stored even in Firebase mode. It costs one bcrypt call and
        # means a later loss of the Web API key downgrades to local verification
        # instead of locking every existing account out.
        password_hash=hash_password(password),
        firebase_uid=firebase_uid,
    )

    try:
        store.create_user(user)
    except Exception as exc:
        # The unique email index rejected it — a concurrent double-submit.
        if "unique" in str(exc).lower() or "already" in str(exc).lower():
            raise AuthError("An account with this email already exists.", 409) from exc
        raise

    profile = _ensure_profile(user)
    log.info("Registered %s (mode=%s)", email, settings.password_auth_mode)
    return user, profile


# ── sign-in ──────────────────────────────────────────────────


def authenticate(email: str, password: str) -> User:
    email = normalise_email(email)
    store = get_store()
    user = store.get_user_by_email(email)

    if not user:
        # Equalise timing so a missing account is indistinguishable from a wrong
        # password, then give the same message for both.
        dummy_verify()
        raise AuthError("Incorrect email or password.")

    if user.disabled:
        raise AuthError("This account has been disabled.", 403)

    verified = False
    if settings.password_auth_mode == "firebase" and user.firebase_uid:
        try:
            firebase.verify_password_with_firebase(email, password)
            verified = True
        except firebase.FirebaseAuthError as exc:
            raise AuthError(str(exc)) from exc
        except firebase.FirebaseUnavailable as exc:
            # The identity provider is unreachable. Fall back to the local hash so a
            # Firebase outage does not lock everyone out, and record that it happened.
            log.warning("Firebase unreachable, using local hash: %s", exc)
            verified = verify_password(password, user.password_hash)
    else:
        verified = verify_password(password, user.password_hash)

    if not verified:
        raise AuthError("Incorrect email or password.")

    store.update_user(user.uid, last_login_at=utc_now())
    user.last_login_at = utc_now()
    _ensure_profile(user)
    return user


def authenticate_firebase_id_token(id_token: str) -> User:
    """Sign in a client that already holds a Firebase ID token.

    This is the Google-sign-in path: the Web SDK authenticates, and we exchange the
    resulting ID token for one of our own sessions, creating the local account on
    first sight so the user has a profile and history like anyone else.
    """
    if not settings.firebase_configured:
        raise AuthError("Firebase sign-in is not configured on this server.", 503)

    try:
        claims = firebase.verify_id_token(id_token)
    except firebase.FirebaseAuthError as exc:
        raise AuthError(str(exc)) from exc
    except firebase.FirebaseUnavailable as exc:
        raise AuthError(f"Identity provider unavailable: {exc}", 503) from exc

    email = normalise_email(claims.get("email") or "")
    if not email:
        raise AuthError("That Firebase account has no email address.", 422)

    store = get_store()
    user = store.get_user_by_email(email)
    firebase_uid = claims.get("uid") or claims.get("sub") or ""

    if user:
        if user.disabled:
            raise AuthError("This account has been disabled.", 403)
        updates: dict[str, Any] = {"last_login_at": utc_now()}
        if firebase_uid and user.firebase_uid != firebase_uid:
            updates["firebase_uid"] = firebase_uid
        store.update_user(user.uid, **updates)
        user.last_login_at = updates["last_login_at"]
    else:
        user = User(
            uid=new_id("usr"),
            email=email,
            display_name=(claims.get("name") or "").strip()[:200],
            # No local password: this account authenticates through Firebase. An
            # empty hash can never verify, which is the correct outcome.
            password_hash="",
            firebase_uid=firebase_uid,
            last_login_at=utc_now(),
        )
        store.create_user(user)

    _ensure_profile(user)
    return user


# ── password change ──────────────────────────────────────────


def change_password(user: User, current_password: str, new_password: str) -> None:
    problem = validate_password(new_password)
    if problem:
        raise AuthError(problem, 422)

    if user.password_hash:
        if not verify_password(current_password, user.password_hash):
            raise AuthError("Current password is incorrect.", 403)
    elif settings.password_auth_mode == "firebase":
        # Federated account with no local password — verify against Firebase.
        try:
            firebase.verify_password_with_firebase(user.email, current_password)
        except (firebase.FirebaseAuthError, firebase.FirebaseUnavailable) as exc:
            raise AuthError("Current password is incorrect.", 403) from exc

    if settings.password_auth_mode == "firebase" and user.firebase_uid:
        try:
            firebase.set_firebase_password(user.firebase_uid, new_password)
        except firebase.FirebaseAuthError as exc:
            raise AuthError(str(exc), 502) from exc

    get_store().update_user(user.uid, password_hash=hash_password(new_password))


def request_password_reset(email: str) -> None:
    """Best-effort reset email. Only available in Firebase mode."""
    if settings.password_auth_mode == "firebase":
        firebase.send_password_reset(normalise_email(email))
