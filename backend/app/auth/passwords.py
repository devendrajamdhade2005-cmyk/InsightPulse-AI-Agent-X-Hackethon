"""Password hashing.

bcrypt directly rather than passlib: passlib 1.7.x misdetects the version of
bcrypt 4+/5+ and emits a spurious error on import, and the only feature we would
use from it is the hash/verify pair bcrypt already provides.

bcrypt truncates input at 72 bytes and, depending on version, either ignores or
rejects the remainder. Pre-hashing with SHA-256 means the full passphrase always
contributes entropy and no input length can ever error.
"""

from __future__ import annotations

import base64
import hashlib
import secrets

import bcrypt

from ..config import settings

# Cost factor. 12 is ~250ms on current hardware — slow enough to make offline
# cracking expensive, fast enough for an interactive login.
_ROUNDS = 12


def _prepare(password: str) -> bytes:
    """SHA-256 then base64, so the value handed to bcrypt is a fixed 44 bytes."""
    digest = hashlib.sha256(password.encode("utf-8")).digest()
    return base64.b64encode(digest)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_prepare(password), bcrypt.gensalt(rounds=_ROUNDS)).decode()


def verify_password(password: str, hashed: str) -> bool:
    if not password or not hashed:
        return False
    try:
        return bcrypt.checkpw(_prepare(password), hashed.encode())
    except (ValueError, TypeError):
        # A malformed stored hash must read as "wrong password", not crash the
        # login endpoint and leak that this account's record is damaged.
        return False


def validate_password(password: str) -> str | None:
    """Returns an error message, or None when acceptable.

    Deliberately a length floor and nothing more: composition rules (one symbol,
    one digit) push users toward predictable substitutions without adding real
    entropy, and NIST guidance has recommended against them for years.
    """
    pw = password or ""
    minimum = max(8, int(settings.password_min_length or 8))
    if len(pw) < minimum:
        return f"Password must be at least {minimum} characters."
    if len(pw) > 200:
        return "Password must be 200 characters or fewer."
    if pw.strip() != pw:
        return "Password cannot start or end with whitespace."
    return None


def dummy_verify() -> None:
    """Burn a comparable amount of time on a fake hash.

    Called when an account does not exist, so a missing email and a wrong password
    take the same time to answer. Without this, response timing enumerates which
    addresses are registered.
    """
    verify_password("timing-equaliser", _DUMMY_HASH)


_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))
