"""Authentication endpoints.

    POST /api/auth/register         create an account
    POST /api/auth/login            email + password → session
    POST /api/auth/firebase         Firebase ID token → session (Google sign-in)
    POST /api/auth/refresh          refresh token → new access token
    POST /api/auth/logout           client-side token discard, recorded here
    POST /api/auth/password/reset   request a reset email (Firebase mode only)
    GET  /api/auth/config           what the frontend needs to render sign-in
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field

from ..auth import service
from ..auth.deps import CurrentUser
from ..auth.service import AuthError
from ..auth.tokens import REFRESH, TokenError, decode_token, issue_session
from ..config import settings
from ..store import get_store
from . import guard

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── login throttling ─────────────────────────────────────────
# Reuses the project's existing sliding-window limiter, on its own key prefix so a
# brute-force attempt cannot hide inside the normal run allowance.
async def _limit_login(request: Request) -> None:
    if not settings.rate_limit_enabled:
        return
    limit = int(settings.login_rate_limit_attempts or 0)
    window = float(settings.login_rate_limit_window_seconds or 300)
    allowed, retry = guard.limiter.check(
        f"login:{guard.client_key(request)}", limit=limit, window_seconds=window
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Too many sign-in attempts ({limit} per "
                f"{int(window / 60)} min). Retry in {retry}s."
            ),
            headers={"Retry-After": str(retry)},
        )


# ── payloads ─────────────────────────────────────────────────
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)
    display_name: str = Field(default="", max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class FirebaseIn(BaseModel):
    id_token: str = Field(min_length=16, max_length=8192)


class RefreshIn(BaseModel):
    refresh_token: str = Field(min_length=16, max_length=4096)


class ResetIn(BaseModel):
    email: EmailStr


class PasswordChangeIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=1, max_length=200)


def _session_payload(user, profile=None) -> dict:
    store = get_store()
    profile = profile or store.get_profile(user.uid)
    return {
        **issue_session(user),
        "user": user.public(),
        "profile": profile.public() if profile else None,
    }


def _fail(exc: AuthError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)


# ── endpoints ────────────────────────────────────────────────
@router.get("/config")
async def auth_config() -> dict:
    """Everything the sign-in screen needs to render correctly.

    The frontend uses this to decide whether to offer "forgot password" and Google
    sign-in, instead of showing controls that cannot work on this deployment.
    """
    return {
        "registration_open": settings.allow_registration,
        "password_min_length": max(8, int(settings.password_min_length or 8)),
        "password_reset_available": settings.password_auth_mode == "firebase",
        "firebase_sign_in_available": settings.firebase_configured,
        "firebase_project_id": settings.firebase_project_id or None,
        "mode": settings.password_auth_mode,
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterIn, _: None = Depends(_limit_login)) -> dict:
    try:
        user, profile = service.register(
            str(body.email), body.password, body.display_name
        )
    except AuthError as exc:
        raise _fail(exc) from exc
    return _session_payload(user, profile)


@router.post("/login")
async def login(body: LoginIn, _: None = Depends(_limit_login)) -> dict:
    try:
        user = service.authenticate(str(body.email), body.password)
    except AuthError as exc:
        raise _fail(exc) from exc
    return _session_payload(user)


@router.post("/firebase")
async def firebase_login(body: FirebaseIn, _: None = Depends(_limit_login)) -> dict:
    """Exchange a Firebase ID token for one of our sessions."""
    try:
        user = service.authenticate_firebase_id_token(body.id_token)
    except AuthError as exc:
        raise _fail(exc) from exc
    return _session_payload(user)


@router.post("/refresh")
async def refresh(body: RefreshIn) -> dict:
    try:
        payload = decode_token(body.refresh_token, expect=REFRESH)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user = get_store().get_user(payload["sub"])
    if not user or user.disabled:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account is no longer active.",
        )
    return _session_payload(user)


@router.post("/logout")
async def logout(user: CurrentUser) -> dict:
    """Acknowledge sign-out.

    Tokens are stateless and short-lived, so the client discarding them *is* the
    sign-out. Saying so plainly is better than implying a server-side revocation
    that does not happen — a deployment needing true revocation would add a token
    denylist here.
    """
    return {
        "signed_out": True,
        "uid": user.uid,
        "note": "Discard the stored tokens on the client.",
    }


@router.post("/password/reset")
async def password_reset(body: ResetIn, _: None = Depends(_limit_login)) -> dict:
    service.request_password_reset(str(body.email))
    # Always the same answer, so this cannot be used to enumerate accounts.
    return {
        "requested": True,
        "detail": "If that address has an account, a reset link is on its way.",
        "available": settings.password_auth_mode == "firebase",
    }


@router.post("/password/change")
async def password_change(body: PasswordChangeIn, user: CurrentUser) -> dict:
    try:
        service.change_password(user, body.current_password, body.new_password)
    except AuthError as exc:
        raise _fail(exc) from exc
    return {"updated": True}
