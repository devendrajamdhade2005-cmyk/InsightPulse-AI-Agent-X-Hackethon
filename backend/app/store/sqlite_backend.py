"""SQLite persistence.

This is the fallback store and the one the tests run against, so it must work with
no network and no credentials. It is also what keeps the project honest about its
"runs with zero configuration" claim now that accounts exist.

JSON-heavy columns are stored as TEXT holding JSON rather than as separate tables.
The nested payloads here (a full agent result, a list of default keywords) are read
and written whole and are never queried by their internals, so normalising them
would add joins and migrations without buying a single query we actually make.
"""

from __future__ import annotations

import json
import threading
from typing import Any

from sqlalchemy import (
    Boolean,
    Column,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    delete,
    func,
    select,
)
from sqlalchemy.engine import Engine

from ..config import settings
from .models import HistoryEntry, Profile, User, utc_now

metadata = MetaData()

users_table = Table(
    "users",
    metadata,
    Column("uid", String(64), primary_key=True),
    # Stored lowercased; the unique index is what actually prevents duplicates
    # under a concurrent double-submit, not the pre-insert existence check.
    Column("email", String(320), nullable=False, unique=True, index=True),
    Column("display_name", String(200), default=""),
    Column("password_hash", Text, default=""),
    Column("firebase_uid", String(128), default="", index=True),
    Column("created_at", String(40), default=""),
    Column("last_login_at", String(40), default=""),
    Column("disabled", Boolean, default=False),
    Column("roles", Text, default="[]"),
)

profiles_table = Table(
    "profiles",
    metadata,
    Column("uid", String(64), primary_key=True),
    Column("display_name", String(200), default=""),
    Column("organisation", String(200), default=""),
    Column("role", String(120), default=""),
    Column("default_keywords", Text, default="[]"),
    Column("default_competitors", Text, default="[]"),
    Column("default_goal", Text, default=""),
    Column("theme", String(16), default="system"),
    Column("updated_at", String(40), default=""),
)

history_table = Table(
    "scan_history",
    metadata,
    Column("entry_id", String(64), primary_key=True),
    Column("uid", String(64), nullable=False, index=True),
    Column("run_id", String(128), nullable=False),
    Column("goal", Text, default=""),
    Column("created_at", String(40), default="", index=True),
    Column("summary", Text, default="{}"),
    Column("result", Text, default="{}"),
)

saved_table = Table(
    "saved_findings",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("uid", String(64), nullable=False, index=True),
    Column("finding_id", String(128), nullable=False),
    Column("created_at", String(40), default=""),
)

tracked_table = Table(
    "tracked_terms",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("uid", String(64), nullable=False, index=True),
    Column("term", String(200), nullable=False),
    Column("created_at", String(40), default=""),
)


def _loads(raw: Any, fallback: Any) -> Any:
    if raw in (None, ""):
        return fallback
    if isinstance(raw, (list, dict)):
        return raw
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return fallback


class SqliteStore:
    """Repository over SQLite. Thread-safe for the write paths we use."""

    backend = "sqlite"

    def __init__(self, url: str | None = None) -> None:
        self._url = url or settings.resolved_database_url()
        # check_same_thread=False because uvicorn serves requests from a threadpool;
        # the lock below serialises the writes that actually need it.
        connect_args = {"check_same_thread": False} if self._url.startswith("sqlite") else {}
        self._engine: Engine = create_engine(
            self._url, future=True, connect_args=connect_args
        )
        self._lock = threading.Lock()
        metadata.create_all(self._engine)

    # ── users ────────────────────────────────────────────────
    def get_user_by_email(self, email: str) -> User | None:
        stmt = select(users_table).where(users_table.c.email == email.strip().lower())
        with self._engine.connect() as conn:
            row = conn.execute(stmt).mappings().first()
        return self._to_user(row) if row else None

    def get_user(self, uid: str) -> User | None:
        stmt = select(users_table).where(users_table.c.uid == uid)
        with self._engine.connect() as conn:
            row = conn.execute(stmt).mappings().first()
        return self._to_user(row) if row else None

    def create_user(self, user: User) -> User:
        record = user.to_record()
        record["email"] = record["email"].strip().lower()
        record["roles"] = json.dumps(record.get("roles") or ["user"])
        with self._lock, self._engine.begin() as conn:
            conn.execute(users_table.insert().values(**record))
        return user

    def update_user(self, uid: str, **fields: Any) -> None:
        if not fields:
            return
        if "roles" in fields:
            fields["roles"] = json.dumps(fields["roles"])
        if "email" in fields:
            fields["email"] = str(fields["email"]).strip().lower()
        with self._lock, self._engine.begin() as conn:
            conn.execute(
                users_table.update().where(users_table.c.uid == uid).values(**fields)
            )

    def count_users(self) -> int:
        with self._engine.connect() as conn:
            return int(conn.execute(select(func.count()).select_from(users_table)).scalar() or 0)

    @staticmethod
    def _to_user(row: Any) -> User:
        data = dict(row)
        data["roles"] = _loads(data.get("roles"), ["user"])
        return User.from_record(data)

    # ── profiles ─────────────────────────────────────────────
    def get_profile(self, uid: str) -> Profile | None:
        stmt = select(profiles_table).where(profiles_table.c.uid == uid)
        with self._engine.connect() as conn:
            row = conn.execute(stmt).mappings().first()
        if not row:
            return None
        data = dict(row)
        data["default_keywords"] = _loads(data.get("default_keywords"), [])
        data["default_competitors"] = _loads(data.get("default_competitors"), [])
        return Profile.from_record(data)

    def save_profile(self, profile: Profile) -> Profile:
        record = profile.to_record()
        record["default_keywords"] = json.dumps(record.get("default_keywords") or [])
        record["default_competitors"] = json.dumps(record.get("default_competitors") or [])
        record["updated_at"] = utc_now()
        with self._lock, self._engine.begin() as conn:
            exists = conn.execute(
                select(profiles_table.c.uid).where(profiles_table.c.uid == profile.uid)
            ).first()
            if exists:
                conn.execute(
                    profiles_table.update()
                    .where(profiles_table.c.uid == profile.uid)
                    .values(**record)
                )
            else:
                conn.execute(profiles_table.insert().values(**record))
        profile.updated_at = record["updated_at"]
        return profile

    # ── history ──────────────────────────────────────────────
    def add_history(self, entry: HistoryEntry, *, retain: int) -> HistoryEntry:
        record = entry.to_record()
        record["summary"] = json.dumps(record.get("summary") or {})
        record["result"] = json.dumps(record.get("result") or {})
        with self._lock, self._engine.begin() as conn:
            conn.execute(history_table.insert().values(**record))
            # Trim oldest beyond the retention cap. Unbounded history would let one
            # account grow the database without limit, since each entry holds a
            # complete run payload.
            if retain > 0:
                keep = conn.execute(
                    select(history_table.c.entry_id)
                    .where(history_table.c.uid == entry.uid)
                    .order_by(history_table.c.created_at.desc())
                    .limit(retain)
                ).scalars().all()
                if keep:
                    conn.execute(
                        delete(history_table).where(
                            history_table.c.uid == entry.uid,
                            history_table.c.entry_id.not_in(keep),
                        )
                    )
        return entry

    def list_history(self, uid: str, *, limit: int = 50) -> list[HistoryEntry]:
        stmt = (
            select(
                history_table.c.entry_id,
                history_table.c.uid,
                history_table.c.run_id,
                history_table.c.goal,
                history_table.c.created_at,
                history_table.c.summary,
            )
            .where(history_table.c.uid == uid)
            .order_by(history_table.c.created_at.desc())
            .limit(limit)
        )
        with self._engine.connect() as conn:
            rows = conn.execute(stmt).mappings().all()
        out = []
        for row in rows:
            data = dict(row)
            data["summary"] = _loads(data.get("summary"), {})
            data["result"] = {}
            out.append(HistoryEntry.from_record(data))
        return out

    def get_history(self, uid: str, entry_id: str) -> HistoryEntry | None:
        stmt = select(history_table).where(
            history_table.c.uid == uid, history_table.c.entry_id == entry_id
        )
        with self._engine.connect() as conn:
            row = conn.execute(stmt).mappings().first()
        if not row:
            return None
        data = dict(row)
        data["summary"] = _loads(data.get("summary"), {})
        data["result"] = _loads(data.get("result"), {})
        return HistoryEntry.from_record(data)

    def delete_history(self, uid: str, entry_id: str) -> bool:
        with self._lock, self._engine.begin() as conn:
            res = conn.execute(
                delete(history_table).where(
                    history_table.c.uid == uid, history_table.c.entry_id == entry_id
                )
            )
        return bool(res.rowcount)

    # ── saved / tracked ──────────────────────────────────────
    def list_saved(self, uid: str) -> list[str]:
        stmt = select(saved_table.c.finding_id).where(saved_table.c.uid == uid)
        with self._engine.connect() as conn:
            return list(conn.execute(stmt).scalars().all())

    def toggle_saved(self, uid: str, finding_id: str) -> bool:
        with self._lock, self._engine.begin() as conn:
            existing = conn.execute(
                select(saved_table.c.id).where(
                    saved_table.c.uid == uid, saved_table.c.finding_id == finding_id
                )
            ).first()
            if existing:
                conn.execute(delete(saved_table).where(saved_table.c.id == existing[0]))
                return False
            conn.execute(
                saved_table.insert().values(
                    uid=uid, finding_id=finding_id, created_at=utc_now()
                )
            )
            return True

    def list_tracked(self, uid: str) -> list[str]:
        stmt = select(tracked_table.c.term).where(tracked_table.c.uid == uid)
        with self._engine.connect() as conn:
            return list(conn.execute(stmt).scalars().all())

    def add_tracked(self, uid: str, term: str) -> list[str]:
        with self._lock, self._engine.begin() as conn:
            existing = conn.execute(
                select(tracked_table.c.id).where(
                    tracked_table.c.uid == uid, tracked_table.c.term == term
                )
            ).first()
            if not existing:
                conn.execute(
                    tracked_table.insert().values(
                        uid=uid, term=term, created_at=utc_now()
                    )
                )
        return self.list_tracked(uid)

    def remove_tracked(self, uid: str, term: str) -> list[str]:
        with self._lock, self._engine.begin() as conn:
            conn.execute(
                delete(tracked_table).where(
                    tracked_table.c.uid == uid, tracked_table.c.term == term
                )
            )
        return self.list_tracked(uid)

    def health(self) -> dict[str, Any]:
        try:
            return {"backend": "sqlite", "ok": True, "users": self.count_users()}
        except Exception as exc:  # pragma: no cover - defensive
            return {"backend": "sqlite", "ok": False, "error": str(exc)}
