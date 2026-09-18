"""Profile, scan history, and the saved/tracked lists.

    GET    /api/me                      account + profile
    PATCH  /api/me/profile              update profile
    GET    /api/me/saved                saved finding ids
    POST   /api/me/saved/{finding_id}   toggle saved
    GET    /api/me/tracked              tracked terms
    POST   /api/me/tracked              add a term
    DELETE /api/me/tracked/{term}       remove a term

    GET    /api/history                 list past scans (headers only)
    POST   /api/history                 save a completed scan
    GET    /api/history/{entry_id}      full stored run, reloadable into the UI
    DELETE /api/history/{entry_id}      delete one entry

Saved and tracked used to live in browser localStorage, which meant they were tied
to one device and lost on a cache clear. Now that accounts exist they belong to the
user, so they follow them across devices.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from ..auth.deps import CurrentUser
from ..config import settings
from ..store import HistoryEntry, Profile, get_store, new_id, summarise_run

router = APIRouter(prefix="/api", tags=["account"])


# ── payloads ─────────────────────────────────────────────────
class ProfileIn(BaseModel):
    """All fields optional: this is a partial update."""

    display_name: str | None = Field(default=None, max_length=200)
    organisation: str | None = Field(default=None, max_length=200)
    role: str | None = Field(default=None, max_length=120)
    default_keywords: list[str] | None = Field(default=None, max_length=20)
    default_competitors: list[str] | None = Field(default=None, max_length=20)
    default_goal: str | None = Field(default=None, max_length=600)
    theme: str | None = Field(default=None, pattern="^(system|light|dark)$")


class TrackedIn(BaseModel):
    term: str = Field(min_length=1, max_length=200)


class HistoryIn(BaseModel):
    """A completed agent result, as returned by /api/agent/run."""

    result: dict[str, Any]


def _clean_list(values: list[str] | None, limit: int = 20) -> list[str] | None:
    if values is None:
        return None
    out: list[str] = []
    for v in values:
        term = str(v).strip()[:120]
        if term and not any(term.lower() == x.lower() for x in out):
            out.append(term)
        if len(out) >= limit:
            break
    return out


# ── account ──────────────────────────────────────────────────
@router.get("/me")
async def me(user: CurrentUser) -> dict:
    store = get_store()
    profile = store.get_profile(user.uid) or store.save_profile(
        Profile(uid=user.uid, display_name=user.display_name)
    )
    return {
        "user": user.public(),
        "profile": profile.public(),
        "saved": store.list_saved(user.uid),
        "tracked": store.list_tracked(user.uid),
        "history_count": len(store.list_history(user.uid, limit=settings.history_retention_per_user)),
    }


@router.patch("/me/profile")
async def update_profile(body: ProfileIn, user: CurrentUser) -> dict:
    store = get_store()
    profile = store.get_profile(user.uid) or Profile(uid=user.uid)

    # Only apply the fields actually present, so a partial update cannot blank out
    # values the client did not send.
    data = body.model_dump(exclude_unset=True)
    if "display_name" in data and data["display_name"] is not None:
        profile.display_name = data["display_name"].strip()
    if "organisation" in data and data["organisation"] is not None:
        profile.organisation = data["organisation"].strip()
    if "role" in data and data["role"] is not None:
        profile.role = data["role"].strip()
    if "default_goal" in data and data["default_goal"] is not None:
        profile.default_goal = data["default_goal"].strip()
    if "theme" in data and data["theme"] is not None:
        profile.theme = data["theme"]

    kw = _clean_list(data.get("default_keywords"))
    if kw is not None:
        profile.default_keywords = kw
    comp = _clean_list(data.get("default_competitors"))
    if comp is not None:
        profile.default_competitors = comp

    saved = store.save_profile(profile)

    # Keep the display name on the account in step with the profile, so the header
    # and the profile screen cannot disagree.
    if saved.display_name and saved.display_name != user.display_name:
        store.update_user(user.uid, display_name=saved.display_name)

    return {"profile": saved.public()}


# ── saved / tracked ──────────────────────────────────────────
@router.get("/me/saved")
async def list_saved(user: CurrentUser) -> dict:
    return {"saved": get_store().list_saved(user.uid)}


@router.post("/me/saved/{finding_id}")
async def toggle_saved(finding_id: str, user: CurrentUser) -> dict:
    store = get_store()
    now_saved = store.toggle_saved(user.uid, finding_id[:128])
    return {"finding_id": finding_id, "saved": now_saved, "all": store.list_saved(user.uid)}


@router.get("/me/tracked")
async def list_tracked(user: CurrentUser) -> dict:
    return {"tracked": get_store().list_tracked(user.uid)}


@router.post("/me/tracked")
async def add_tracked(body: TrackedIn, user: CurrentUser) -> dict:
    return {"tracked": get_store().add_tracked(user.uid, body.term.strip())}


@router.delete("/me/tracked/{term}")
async def remove_tracked(term: str, user: CurrentUser) -> dict:
    return {"tracked": get_store().remove_tracked(user.uid, term)}


# ── history ──────────────────────────────────────────────────
@router.get("/history")
async def list_history(
    user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=200),
) -> dict:
    entries = get_store().list_history(user.uid, limit=limit)
    return {
        "history": [e.header() for e in entries],
        "count": len(entries),
        "retention": settings.history_retention_per_user,
    }


@router.post("/history", status_code=status.HTTP_201_CREATED)
async def save_history(body: HistoryIn, user: CurrentUser) -> dict:
    result = body.result or {}
    run_id = str(result.get("run_id") or "").strip()
    if not run_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The result payload has no run_id, so it is not a completed scan.",
        )

    store = get_store()

    # A re-save of the same run is a no-op rather than a duplicate. The frontend
    # saves on completion, and a retry after a flaky response should not create a
    # second copy of a scan the user only ran once.
    for existing in store.list_history(user.uid, limit=settings.history_retention_per_user):
        if existing.run_id == run_id:
            return {"entry": existing.header(), "created": False}

    entry = HistoryEntry(
        entry_id=new_id("hist"),
        uid=user.uid,
        run_id=run_id,
        goal=str(result.get("goal") or "")[:600],
        summary=summarise_run(result),
        result=result,
    )
    store.add_history(entry, retain=settings.history_retention_per_user)
    return {"entry": entry.header(), "created": True}


@router.get("/history/{entry_id}")
async def get_history(entry_id: str, user: CurrentUser) -> dict:
    # Scoped to the caller's uid, so an id guessed from another account 404s.
    entry = get_store().get_history(user.uid, entry_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No such history entry."
        )
    return {"entry": entry.header(), "result": entry.result}


@router.delete("/history/{entry_id}")
async def delete_history(entry_id: str, user: CurrentUser) -> dict:
    if not get_store().delete_history(user.uid, entry_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No such history entry."
        )
    return {"deleted": True, "entry_id": entry_id}
