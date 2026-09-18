"""Authentication, profile and history tests.

These run against the SQLite store with Firebase disabled, so they need no network
and no credentials — the same standard the rest of this suite holds to.

The point of each test is a behaviour someone could plausibly break:
identity isolation between accounts, timing-safe login failure, partial profile
updates, history de-duplication, and the retention cap.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app import store
from app.api import guard
from app.auth import passwords, tokens
from app.config import get_settings
from app.main import app

settings = get_settings()


@pytest.fixture(scope="module", autouse=True)
def _isolate_backend():
    """Force this module onto a scratch SQLite store with Firebase disabled.

    Setting environment variables at import time does NOT work here: `get_settings`
    is `lru_cache`d, so whichever test module imports `app.config` first decides
    the configuration for the whole session. When the full suite runs, that is
    another module, and these tests would silently execute against the real
    configured backend — which is how they came to pass in isolation and fail
    together.

    Mutating the live settings object instead is order-independent, and the store
    singleton is reset either side so it is rebuilt against these values and then
    handed back unchanged.
    """
    overrides = {
        "database_url": f"sqlite:///./data/test_auth_{uuid.uuid4().hex[:8]}.db",
        "firebase_enabled": False,
        "firestore_enabled": False,
        "firebase_web_api_key": "",
        "firebase_credentials_file": "",
        "firebase_credentials_json": "",
        "allow_registration": True,
        "rate_limit_enabled": True,
    }
    saved = {key: getattr(settings, key) for key in overrides}
    for key, value in overrides.items():
        setattr(settings, key, value)
    store.reset_store()

    yield

    for key, value in saved.items():
        setattr(settings, key, value)
    store.reset_store()


@pytest.fixture(autouse=True)
def _clean_state():
    """Fresh limiter between tests so the login throttle cannot leak across them."""
    guard.reset()
    yield
    guard.reset()


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


_counter = {"n": 0}


def _email() -> str:
    _counter["n"] += 1
    return f"user{_counter['n']}@insightpulse-qa.dev"


def _register(client, email=None, password="correct-horse-battery"):
    email = email or _email()
    res = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "display_name": "Test Analyst"},
    )
    assert res.status_code == 201, res.text
    return email, password, res.json()


def _auth(session: dict) -> dict:
    return {"Authorization": f"Bearer {session['access_token']}"}


# ── password hashing ─────────────────────────────────────────
def test_01_password_hash_roundtrip_and_rejects_wrong():
    hashed = passwords.hash_password("a-real-passphrase")
    assert hashed != "a-real-passphrase"
    assert passwords.verify_password("a-real-passphrase", hashed)
    assert not passwords.verify_password("a-real-passphras", hashed)


def test_02_long_password_is_not_silently_truncated():
    """bcrypt caps at 72 bytes; the SHA-256 pre-hash must carry the whole input.

    Without pre-hashing these two 80-character passwords share their first 72 bytes
    and would verify interchangeably.
    """
    base = "x" * 72
    hashed = passwords.hash_password(base + "AAAAAAAA")
    assert not passwords.verify_password(base + "BBBBBBBB", hashed)


def test_03_malformed_stored_hash_reads_as_wrong_password():
    assert not passwords.verify_password("anything", "not-a-bcrypt-hash")


def test_04_password_policy_enforces_length_only():
    assert passwords.validate_password("short") is not None
    assert passwords.validate_password("longenoughpassword") is None
    assert passwords.validate_password(" leadingspace123") is not None


# ── tokens ───────────────────────────────────────────────────
def test_05_access_token_roundtrip():
    issued = tokens.issue_token("usr_abc", email="a@b.c", roles=["user"])
    payload = tokens.decode_token(issued["token"])
    assert payload["sub"] == "usr_abc"
    assert payload["typ"] == tokens.ACCESS


def test_06_refresh_token_cannot_be_used_as_access_token():
    """Both are signed by the same key, so only the purpose claim separates them."""
    issued = tokens.issue_token("usr_abc", kind=tokens.REFRESH)
    with pytest.raises(tokens.TokenError):
        tokens.decode_token(issued["token"], expect=tokens.ACCESS)


def test_07_tampered_token_is_rejected():
    issued = tokens.issue_token("usr_abc")
    bad = issued["token"][:-3] + "abc"
    with pytest.raises(tokens.TokenError):
        tokens.decode_token(bad)


def test_08_expired_token_is_rejected():
    issued = tokens.issue_token("usr_abc", ttl_minutes=-1)
    with pytest.raises(tokens.TokenError):
        tokens.decode_token(issued["token"])


# ── registration & login ─────────────────────────────────────
def test_09_register_returns_session_and_profile(client):
    _, _, body = _register(client)
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["user"]["email"].endswith("@insightpulse-qa.dev")
    assert body["profile"]["uid"] == body["user"]["uid"]
    # The hash must never leave the server.
    assert "password_hash" not in body["user"]


def test_10_duplicate_email_is_refused(client):
    email, password, _ = _register(client)
    res = client.post(
        "/api/auth/register", json={"email": email, "password": password}
    )
    assert res.status_code == 409


def test_11_login_succeeds_and_records_last_login(client):
    email, password, _ = _register(client)
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    assert res.json()["user"]["last_login_at"]


def test_12_login_is_case_insensitive_on_email(client):
    email, password, _ = _register(client)
    res = client.post(
        "/api/auth/login", json={"email": email.upper(), "password": password}
    )
    assert res.status_code == 200


def test_13_wrong_password_and_unknown_email_give_identical_answers(client):
    """Neither the status nor the message may reveal whether an account exists."""
    email, _, _ = _register(client)
    wrong = client.post(
        "/api/auth/login", json={"email": email, "password": "definitely-not-it"}
    )
    missing = client.post(
        "/api/auth/login",
        json={"email": "nobody@insightpulse-qa.dev", "password": "definitely-not-it"},
    )
    assert wrong.status_code == missing.status_code == 401
    assert wrong.json()["detail"] == missing.json()["detail"]


def test_14_short_password_is_refused_at_registration(client):
    res = client.post(
        "/api/auth/register", json={"email": _email(), "password": "abc"}
    )
    assert res.status_code == 422


def test_15_refresh_issues_a_new_access_token(client):
    _, _, body = _register(client)
    res = client.post(
        "/api/auth/refresh", json={"refresh_token": body["refresh_token"]}
    )
    assert res.status_code == 200, res.text
    assert res.json()["access_token"]


def test_16_access_token_rejected_by_refresh_endpoint(client):
    _, _, body = _register(client)
    res = client.post(
        "/api/auth/refresh", json={"refresh_token": body["access_token"]}
    )
    assert res.status_code == 401


def test_17_auth_config_declares_the_active_mode(client):
    body = client.get("/api/auth/config").json()
    # Firebase is off in this suite, so the weaker path must be declared honestly.
    assert body["mode"] == "local"
    assert body["password_reset_available"] is False
    assert body["firebase_sign_in_available"] is False


# ── protected endpoints ──────────────────────────────────────
def test_18_me_requires_authentication(client):
    assert client.get("/api/me").status_code == 401


def test_19_garbage_bearer_token_is_rejected(client):
    res = client.get("/api/me", headers={"Authorization": "Bearer not.a.token"})
    assert res.status_code == 401


def test_20_me_returns_account_profile_and_lists(client):
    _, _, session = _register(client)
    body = client.get("/api/me", headers=_auth(session)).json()
    assert body["user"]["uid"] == session["user"]["uid"]
    assert body["saved"] == []
    assert body["tracked"] == []


# ── profile ──────────────────────────────────────────────────
def test_21_profile_partial_update_preserves_untouched_fields(client):
    _, _, session = _register(client)
    headers = _auth(session)

    client.patch(
        "/api/me/profile",
        json={"organisation": "Acme Research", "default_keywords": ["AI agents"]},
        headers=headers,
    )
    # A second patch that omits organisation must not blank it.
    res = client.patch("/api/me/profile", json={"role": "Analyst"}, headers=headers)
    profile = res.json()["profile"]
    assert profile["organisation"] == "Acme Research"
    assert profile["role"] == "Analyst"
    assert profile["default_keywords"] == ["AI agents"]


def test_22_profile_deduplicates_keywords_case_insensitively(client):
    _, _, session = _register(client)
    res = client.patch(
        "/api/me/profile",
        json={"default_keywords": ["AI agents", "ai AGENTS", "robotics"]},
        headers=_auth(session),
    )
    assert res.json()["profile"]["default_keywords"] == ["AI agents", "robotics"]


def test_23_invalid_theme_is_refused(client):
    _, _, session = _register(client)
    res = client.patch(
        "/api/me/profile", json={"theme": "neon"}, headers=_auth(session)
    )
    assert res.status_code == 422


# ── saved / tracked ──────────────────────────────────────────
def test_24_saved_toggles_and_persists(client):
    _, _, session = _register(client)
    headers = _auth(session)

    on = client.post("/api/me/saved/find-1", headers=headers).json()
    assert on["saved"] is True and "find-1" in on["all"]

    off = client.post("/api/me/saved/find-1", headers=headers).json()
    assert off["saved"] is False and "find-1" not in off["all"]


def test_25_tracked_add_and_remove(client):
    _, _, session = _register(client)
    headers = _auth(session)

    added = client.post("/api/me/tracked", json={"term": "OpenAI"}, headers=headers)
    assert "OpenAI" in added.json()["tracked"]

    removed = client.delete("/api/me/tracked/OpenAI", headers=headers)
    assert "OpenAI" not in removed.json()["tracked"]


def test_26_saved_lists_are_isolated_between_accounts(client):
    """The tenancy boundary — one account must never see another's data."""
    _, _, a = _register(client)
    _, _, b = _register(client)

    client.post("/api/me/saved/secret-finding", headers=_auth(a))
    assert client.get("/api/me/saved", headers=_auth(b)).json()["saved"] == []


# ── history ──────────────────────────────────────────────────
def _run_payload(run_id="run-1", goal="Track AI agents"):
    return {
        "run_id": run_id,
        "goal": goal,
        "findings": [{"id": "f1", "relevance": 0.8}, {"id": "f2", "relevance": 0.5}],
        "insights": [{"finding_id": "f1", "priority": "HIGH"}],
        "metrics": {
            "priority_counts": {"HIGH": 1},
            "tools_used": ["research_search"],
            "reasoner": "heuristic",
            "duration_ms": 3200,
        },
        "state": {"competitors": ["OpenAI"]},
    }


def test_27_history_saves_and_reloads_the_full_run(client):
    _, _, session = _register(client)
    headers = _auth(session)

    created = client.post(
        "/api/history", json={"result": _run_payload()}, headers=headers
    )
    assert created.status_code == 201, created.text
    entry_id = created.json()["entry"]["entry_id"]

    # The list view carries the denormalised header, not the payload.
    listed = client.get("/api/history", headers=headers).json()
    assert listed["count"] == 1
    assert listed["history"][0]["findings"] == 2
    assert listed["history"][0]["high_priority"] == 1

    # The detail view carries the whole result, so a past scan can be reopened.
    detail = client.get(f"/api/history/{entry_id}", headers=headers).json()
    assert detail["result"]["run_id"] == "run-1"
    assert len(detail["result"]["findings"]) == 2


def test_28_saving_the_same_run_twice_does_not_duplicate(client):
    _, _, session = _register(client)
    headers = _auth(session)
    payload = {"result": _run_payload(run_id="run-dupe")}

    first = client.post("/api/history", json=payload, headers=headers)
    second = client.post("/api/history", json=payload, headers=headers)

    assert first.json()["created"] is True
    assert second.json()["created"] is False
    assert client.get("/api/history", headers=headers).json()["count"] == 1


def test_29_result_without_run_id_is_refused(client):
    _, _, session = _register(client)
    res = client.post(
        "/api/history", json={"result": {"goal": "no id"}}, headers=_auth(session)
    )
    assert res.status_code == 422


def test_30_history_is_isolated_between_accounts(client):
    _, _, a = _register(client)
    _, _, b = _register(client)

    created = client.post(
        "/api/history", json={"result": _run_payload(run_id="run-private")},
        headers=_auth(a),
    )
    entry_id = created.json()["entry"]["entry_id"]

    # B must not be able to read A's entry even with the exact id.
    assert client.get(f"/api/history/{entry_id}", headers=_auth(b)).status_code == 404
    assert client.get("/api/history", headers=_auth(b)).json()["count"] == 0


def test_31_history_delete_works_and_is_scoped(client):
    _, _, a = _register(client)
    _, _, b = _register(client)
    created = client.post(
        "/api/history", json={"result": _run_payload(run_id="run-del")},
        headers=_auth(a),
    )
    entry_id = created.json()["entry"]["entry_id"]

    assert client.delete(f"/api/history/{entry_id}", headers=_auth(b)).status_code == 404
    assert client.delete(f"/api/history/{entry_id}", headers=_auth(a)).status_code == 200
    assert client.get("/api/history", headers=_auth(a)).json()["count"] == 0


def test_32_history_retention_trims_oldest(client):
    """Unbounded history would let one account grow the DB without limit."""
    _, _, session = _register(client)
    headers = _auth(session)
    st = store.get_store()
    uid = session["user"]["uid"]

    for i in range(5):
        entry = store.HistoryEntry(
            entry_id=store.new_id("hist"),
            uid=uid,
            run_id=f"run-{i}",
            goal="retention probe",
            created_at=f"2026-01-0{i + 1}T00:00:00+00:00",
            summary={"findings": i},
        )
        st.add_history(entry, retain=3)

    kept = st.list_history(uid, limit=50)
    assert len(kept) == 3
    # Newest three survive.
    assert {e.run_id for e in kept} == {"run-2", "run-3", "run-4"}


# ── password change ──────────────────────────────────────────
def test_33_password_change_requires_the_current_password(client):
    email, password, session = _register(client)
    headers = _auth(session)

    wrong = client.post(
        "/api/auth/password/change",
        json={"current_password": "not-it", "new_password": "a-brand-new-secret"},
        headers=headers,
    )
    assert wrong.status_code == 403

    ok = client.post(
        "/api/auth/password/change",
        json={"current_password": password, "new_password": "a-brand-new-secret"},
        headers=headers,
    )
    assert ok.status_code == 200

    # Old password no longer works; new one does.
    assert client.post(
        "/api/auth/login", json={"email": email, "password": password}
    ).status_code == 401
    assert client.post(
        "/api/auth/login", json={"email": email, "password": "a-brand-new-secret"}
    ).status_code == 200


def test_34_password_reset_answer_does_not_reveal_account_existence(client):
    email, _, _ = _register(client)
    known = client.post("/api/auth/password/reset", json={"email": email})
    unknown = client.post(
        "/api/auth/password/reset", json={"email": "ghost@insightpulse-qa.dev"}
    )
    assert known.status_code == unknown.status_code == 200
    assert known.json()["detail"] == unknown.json()["detail"]


# ── throttling ───────────────────────────────────────────────
def test_35_login_attempts_are_rate_limited(client):
    email, _, _ = _register(client)
    limit = int(settings.login_rate_limit_attempts or 10)

    statuses = [
        client.post(
            "/api/auth/login", json={"email": email, "password": "wrong-every-time"}
        ).status_code
        for _ in range(limit + 4)
    ]
    assert 429 in statuses, "brute-force attempts must eventually be throttled"


# ── health reporting ─────────────────────────────────────────
def test_36_health_reports_identity_and_store_state(client):
    body = client.get("/health").json()
    assert body["identity"]["password_verification"] == "local"
    assert body["identity"]["store"] == "sqlite"
    assert body["store"]["backend"] == "sqlite"
    # The report must never carry a credential.
    blob = repr(body).lower()
    assert "private_key" not in blob
    assert "bearer" not in blob
