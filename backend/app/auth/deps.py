"""FastAPI dependencies for authentication.

Two flavours deliberately:

  * `current_user`  — required. 401 when absent or invalid.
  * `optional_user` — returns None when absent.

`optional_user` exists so the agent endpoints can stay usable without an account
(the hosted demo depends on that) while still attributing a run to whoever is
signed in. Making authentication mandatory there would have been a behaviour
change to endpoints this work was not meant to touch.

Both accept either of our own session tokens or, when Firebase is configured, a
Firebase ID token. Accepting both means the frontend can use Google sign-in without
a second endpoint.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from ..config import settings
from ..store import User, get_store
from . import firebase
from .tokens import TokenError, decode_token

_BEARER = "bearer "


def _extract_bearer(request: Request) -> str:
    header = request.headers.get("authorization") or ""
    if header.lower().startswith(_BEARER):
        return header[len(_BEARER) :].strip()
    return ""


def _unauthorised(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _user_from_our_token(token: str) -> User | None:
    try:
        payload = decode_token(token)
    except TokenError:
        return None
    user = get_store().get_user(payload["sub"])
    if user and not user.disabled:
        return user
    return None


def _user_from_firebase_token(token: str) -> User | None:
    """Fall back to treating the bearer as a Firebase ID token."""
    if not settings.firebase_configured:
        return None
    try:
        claims = firebase.verify_id_token(token)
    except (firebase.FirebaseAuthError, firebase.FirebaseUnavailable):
        return None
    email = (claims.get("email") or "").strip().lower()
    if not email:
        return None
    user = get_store().get_user_by_email(email)
    if user and not user.disabled:
        return user
    return None


def _resolve(request: Request) -> User | None:
    token = _extract_bearer(request)
    if not token:
        return None
    return _user_from_our_token(token) or _user_from_firebase_token(token)


async def current_user(request: Request) -> User:
    """Require a signed-in user."""
    user = _resolve(request)
    if not user:
        raise _unauthorised("Sign in to continue.")
    return user


async def optional_user(request: Request) -> User | None:
    """Attribute the request if possible, but never block it."""
    return _resolve(request)


CurrentUser = Annotated[User, Depends(current_user)]
OptionalUser = Annotated[User | None, Depends(optional_user)]
