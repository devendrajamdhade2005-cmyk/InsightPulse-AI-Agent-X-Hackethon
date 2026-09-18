"""Domain records for accounts, profiles and saved history.

Plain dataclasses rather than ORM entities, because two very different backends
persist them (Firestore documents and SQLite rows) and neither should dictate the
shape the rest of the app sees.

Nothing here ever carries a password in plaintext. `password_hash` is a bcrypt
digest and is stripped before a record reaches the API layer — see `User.public()`.
"""

from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


def utc_now() -> str:
    """ISO-8601 UTC. Stored as a string so Firestore and SQLite agree on format."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


@dataclass
class User:
    """An account.

    `uid` is ours, not Firebase's. When Firebase Auth is active the Firebase uid is
    kept in `firebase_uid` so the two identities can be linked without making our
    primary key depend on an external service being reachable.
    """

    uid: str
    email: str
    display_name: str = ""
    password_hash: str = ""
    firebase_uid: str = ""
    created_at: str = field(default_factory=utc_now)
    last_login_at: str = ""
    disabled: bool = False
    # Reserved for future role checks. Present now so the token payload shape does
    # not have to change later.
    roles: list[str] = field(default_factory=lambda: ["user"])

    def public(self) -> dict[str, Any]:
        """Safe representation. Never includes the hash."""
        return {
            "uid": self.uid,
            "email": self.email,
            "display_name": self.display_name,
            "created_at": self.created_at,
            "last_login_at": self.last_login_at or None,
            "roles": list(self.roles),
            "linked_to_firebase": bool(self.firebase_uid),
        }

    def to_record(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_record(cls, data: dict[str, Any]) -> "User":
        known = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in (data or {}).items() if k in known})


@dataclass
class Profile:
    """User-editable preferences and defaults for new scans."""

    uid: str
    display_name: str = ""
    organisation: str = ""
    role: str = ""
    # Seeded into the search form so a returning user does not retype their brief.
    default_keywords: list[str] = field(default_factory=list)
    default_competitors: list[str] = field(default_factory=list)
    default_goal: str = ""
    theme: str = "system"  # system | light | dark
    updated_at: str = field(default_factory=utc_now)

    def public(self) -> dict[str, Any]:
        return asdict(self)

    def to_record(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_record(cls, data: dict[str, Any]) -> "Profile":
        known = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in (data or {}).items() if k in known})


@dataclass
class HistoryEntry:
    """One completed scan, owned by one user.

    `summary` is a small denormalised header so the history list renders without
    loading every full run payload. `result` is the complete agent result, kept so a
    past scan can be reopened in the dashboard without re-running the agent — which
    is the whole point of storing it, since a re-run costs API quota and would
    return different data.
    """

    entry_id: str
    uid: str
    run_id: str
    goal: str
    created_at: str = field(default_factory=utc_now)
    summary: dict[str, Any] = field(default_factory=dict)
    result: dict[str, Any] = field(default_factory=dict)

    def header(self) -> dict[str, Any]:
        """List representation — deliberately without the full result payload."""
        return {
            "entry_id": self.entry_id,
            "run_id": self.run_id,
            "goal": self.goal,
            "created_at": self.created_at,
            **self.summary,
        }

    def to_record(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_record(cls, data: dict[str, Any]) -> "HistoryEntry":
        known = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in (data or {}).items() if k in known})


def summarise_run(result: dict[str, Any]) -> dict[str, Any]:
    """Build the denormalised header for a history entry.

    Reads only what the agent actually reported. Absent metrics stay absent rather
    than becoming zeros, so the history list cannot imply a scan found nothing when
    the truth is that a figure was not recorded.
    """
    metrics = result.get("metrics") or {}
    priority = metrics.get("priority_counts") or {}
    findings = result.get("findings") or []
    insights = result.get("insights") or []
    return {
        "findings": len(findings),
        "insights": len(insights),
        "high_priority": priority.get("HIGH", 0),
        "tools_used": list(metrics.get("tools_used") or []),
        "reasoner": metrics.get("reasoner"),
        "duration_ms": metrics.get("duration_ms"),
        "simulated": bool(metrics.get("simulated_data_used")),
        "competitors": list((result.get("state") or {}).get("competitors") or []),
    }
