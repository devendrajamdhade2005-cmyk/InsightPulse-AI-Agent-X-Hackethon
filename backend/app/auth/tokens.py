"""Session tokens issued by this service.

HS256 JWTs signed with SECRET_KEY. `config.Settings._strong_key` already stretches
a short dev key to 32 bytes, so the signing key is never too small for the
algorithm even with the default value.

These are our own tokens, distinct from Firebase ID tokens. The frontend always
carries one of ours, which keeps the client ignorant of which credential backend
verified the password and lets the Firebase path be enabled later without touching
frontend code.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from ..config import settings

ALGORITHM = "HS256"
_ISSUER = "insightpulse"

# Token purpose. Kept explicit so a refresh token can never be replayed as an
# access token just because both are signed by the same key.
ACCESS = "access"
REFRESH = "refresh"


class TokenError(Exception):
    """Raised when a token is missing, malformed, expired or the wrong type."""


def _ttl_minutes() -> int:
    return max(5, int(settings.access_token_ttl_minutes or 60 * 24 * 7))


def issue_token(
    uid: str,
    *,
    email: str = "",
    roles: list[str] | None = None,
    kind: str = ACCESS,
    ttl_minutes: int | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    minutes = ttl_minutes if ttl_minutes is not None else _ttl_minutes()
    # A refresh token outliving the access token is the point; 30 days matches a
    # "stay signed in" expectation without being indefinite.
    if kind == REFRESH and ttl_minutes is None:
        minutes = 60 * 24 * 30
    expires = now + timedelta(minutes=minutes)

    payload = {
        "sub": uid,
        "email": email,
        "roles": roles or ["user"],
        "typ": kind,
        "iss": _ISSUER,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
    return {
        "token": token,
        "expires_at": expires.isoformat(timespec="seconds"),
        "expires_in": int(minutes * 60),
    }


def decode_token(token: str, *, expect: str = ACCESS) -> dict[str, Any]:
    """Verify signature, expiry, issuer and purpose. Raises TokenError otherwise."""
    if not token:
        raise TokenError("No token supplied.")
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[ALGORITHM],
            issuer=_ISSUER,
            options={"require": ["exp", "sub", "iss"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Session expired. Please sign in again.") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("Invalid session token.") from exc

    if payload.get("typ") != expect:
        raise TokenError(f"Expected a {expect} token.")
    if not payload.get("sub"):
        raise TokenError("Token is missing a subject.")
    return payload


def issue_session(user: Any) -> dict[str, Any]:
    """Access + refresh pair for a freshly authenticated user."""
    access = issue_token(
        user.uid, email=user.email, roles=user.roles, kind=ACCESS
    )
    refresh = issue_token(
        user.uid, email=user.email, roles=user.roles, kind=REFRESH
    )
    return {
        "access_token": access["token"],
        "token_type": "bearer",
        "expires_in": access["expires_in"],
        "expires_at": access["expires_at"],
        "refresh_token": refresh["token"],
        "refresh_expires_at": refresh["expires_at"],
    }
