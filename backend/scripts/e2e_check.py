"""End-to-end check against a running backend.

Exercises the whole authenticated path the React frontend uses, in order:

    health -> auth/config -> register -> me -> profile PATCH -> saved/tracked
    -> agent run (simulation) -> history POST -> history GET -> history detail
    -> report generate -> refresh -> password change -> re-login

Runs in simulation mode so it makes no outbound provider calls and spends no
quota. Exits non-zero on the first failure so it is usable as a smoke gate.

Usage:  python scripts/e2e_check.py [base_url]
"""

from __future__ import annotations

import json
import sys
import time
import uuid

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
TIMEOUT = 180.0

passed = 0
failed: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> bool:
    global passed
    if condition:
        passed += 1
        print(f"  PASS  {name}")
        return True
    failed.append(name)
    print(f"  FAIL  {name}" + (f"  -> {detail}" if detail else ""))
    return False


def section(title: str) -> None:
    print(f"\n{title}")


def main() -> int:
    client = httpx.Client(base_url=BASE, timeout=TIMEOUT)
    email = f"e2e-{uuid.uuid4().hex[:10]}@insightpulse-qa.dev"
    password = "e2e-verification-passphrase"

    # ── health ───────────────────────────────────────────────
    section("health + capability")
    r = client.get("/health")
    check("GET /health is 200", r.status_code == 200, r.text[:200])
    health = r.json() if r.status_code == 200 else {}
    check("tools are registered", len(health.get("tools") or []) == 5,
          str(health.get("tools")))
    check("identity block present", "identity" in health)
    check("store block present", "store" in health)
    store_backend = (health.get("store") or {}).get("backend")
    print(f"        store backend      = {store_backend}")
    print(f"        password verify    = {(health.get('identity') or {}).get('password_verification')}")
    print(f"        reasoner           = {health.get('reasoner')}")
    degraded = (health.get("store") or {}).get("degraded")
    if degraded:
        print(f"        NOTE store degraded: {degraded}")

    r = client.get("/api/auth/config")
    check("GET /api/auth/config is 200", r.status_code == 200, r.text[:200])

    # ── register ─────────────────────────────────────────────
    section("registration + session")
    r = client.post("/api/auth/register", json={
        "email": email, "password": password, "display_name": "E2E Analyst",
    })
    if not check("POST /api/auth/register is 201", r.status_code == 201, r.text[:300]):
        return report()
    session = r.json()
    token = session["access_token"]
    refresh_token = session["refresh_token"]
    auth = {"Authorization": f"Bearer {token}"}
    check("access token issued", bool(token))
    check("refresh token issued", bool(refresh_token))
    check("password hash never returned", "password_hash" not in json.dumps(session))

    r = client.post("/api/auth/register", json={"email": email, "password": password})
    check("duplicate email rejected with 409", r.status_code == 409, r.text[:200])

    # ── identity ─────────────────────────────────────────────
    section("account")
    r = client.get("/api/me", headers=auth)
    check("GET /api/me is 200", r.status_code == 200, r.text[:200])
    me = r.json() if r.status_code == 200 else {}
    check("email round-trips", (me.get("user") or {}).get("email") == email)

    check("GET /api/me without token is 401",
          client.get("/api/me").status_code == 401)

    r = client.patch("/api/me/profile", headers=auth, json={
        "organisation": "E2E Labs",
        "default_keywords": ["AI agents", "ai AGENTS", "robotics"],
        "default_competitors": ["OpenAI"],
    })
    check("PATCH /api/me/profile is 200", r.status_code == 200, r.text[:200])
    prof = (r.json() or {}).get("profile", {}) if r.status_code == 200 else {}
    check("keywords deduplicated case-insensitively",
          prof.get("default_keywords") == ["AI agents", "robotics"],
          str(prof.get("default_keywords")))

    r = client.patch("/api/me/profile", headers=auth, json={"role": "Analyst"})
    check("partial update preserves organisation",
          ((r.json() or {}).get("profile") or {}).get("organisation") == "E2E Labs")

    # ── saved / tracked ──────────────────────────────────────
    section("saved + tracked")
    r = client.post("/api/me/saved/e2e-finding-1", headers=auth)
    check("toggle saved on", (r.json() or {}).get("saved") is True, r.text[:200])
    r = client.post("/api/me/saved/e2e-finding-1", headers=auth)
    check("toggle saved off", (r.json() or {}).get("saved") is False)

    r = client.post("/api/me/tracked", headers=auth, json={"term": "OpenAI"})
    check("add tracked term", "OpenAI" in ((r.json() or {}).get("tracked") or []))
    r = client.delete("/api/me/tracked/OpenAI", headers=auth)
    check("remove tracked term", "OpenAI" not in ((r.json() or {}).get("tracked") or []))

    # ── a real agent run ─────────────────────────────────────
    section("agent run (simulation mode — no outbound calls)")
    started = time.time()
    r = client.post("/api/agent/run", json={
        "goal": "Track AI agent research and monitor OpenAI",
        "keywords": ["AI agents"],
        "competitors": ["OpenAI"],
        "max_iterations": 4,
        "simulation_mode": True,
    })
    if not check("POST /api/agent/run is 200", r.status_code == 200, r.text[:400]):
        return report()
    run = r.json()
    elapsed = time.time() - started
    check("run has a run_id", bool(run.get("run_id")))
    check("run produced findings", len(run.get("findings") or []) > 0,
          f"findings={len(run.get('findings') or [])}")
    print(f"        run_id   = {run.get('run_id')}")
    print(f"        findings = {len(run.get('findings') or [])}, "
          f"insights = {len(run.get('insights') or [])}, {elapsed:.1f}s")

    # ── history round-trip ───────────────────────────────────
    section("scan history")
    r = client.post("/api/history", headers=auth, json={"result": run})
    check("POST /api/history is 201", r.status_code == 201, r.text[:300])
    created = r.json() if r.status_code == 201 else {}
    entry_id = (created.get("entry") or {}).get("entry_id")
    check("history entry created", created.get("created") is True)

    r = client.post("/api/history", headers=auth, json={"result": run})
    check("re-saving the same run does not duplicate",
          (r.json() or {}).get("created") is False)

    r = client.get("/api/history", headers=auth)
    hist = r.json() if r.status_code == 200 else {}
    check("GET /api/history lists exactly one entry", hist.get("count") == 1,
          str(hist.get("count")))
    header = (hist.get("history") or [{}])[0]
    check("list header carries denormalised counts", "findings" in header,
          str(header)[:200])
    check("list header omits the full payload", "result" not in header)

    if entry_id:
        r = client.get(f"/api/history/{entry_id}", headers=auth)
        detail = r.json() if r.status_code == 200 else {}
        check("history detail returns the full run",
              (detail.get("result") or {}).get("run_id") == run.get("run_id"))
        check("reloaded run has all findings",
              len((detail.get("result") or {}).get("findings") or [])
              == len(run.get("findings") or []))

    # ── tenancy isolation ────────────────────────────────────
    section("tenancy isolation")
    other_email = f"e2e-{uuid.uuid4().hex[:10]}@insightpulse-qa.dev"
    r = client.post("/api/auth/register", json={
        "email": other_email, "password": password,
    })
    if r.status_code == 201:
        other_auth = {"Authorization": f"Bearer {r.json()['access_token']}"}
        r = client.get("/api/history", headers=other_auth)
        check("second account sees no history", (r.json() or {}).get("count") == 0)
        if entry_id:
            r = client.get(f"/api/history/{entry_id}", headers=other_auth)
            check("second account cannot read the first's entry by id",
                  r.status_code == 404, str(r.status_code))
        r = client.get("/api/me/saved", headers=other_auth)
        check("second account sees no saved items",
              (r.json() or {}).get("saved") == [])

    # ── report ───────────────────────────────────────────────
    section("report generation")
    r = client.post("/api/report/generate", json={"run_id": run["run_id"]})
    if check("POST /api/report/generate is 200", r.status_code == 200, r.text[:300]):
        report_id = ((r.json() or {}).get("report") or {}).get("report_id")
        check("report id returned", bool(report_id))
        if report_id:
            r = client.get(f"/api/report/{report_id}/preview?embedded=true")
            check("report preview renders HTML", r.status_code == 200
                  and "<" in r.text, str(r.status_code))
            r = client.get(f"/api/report/{report_id}/download/pdf")
            check("PDF download is a real PDF",
                  r.status_code == 200 and r.content[:4] == b"%PDF",
                  f"{r.status_code} {r.content[:8]!r}")

    # ── token lifecycle ──────────────────────────────────────
    section("token lifecycle")
    r = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    check("refresh issues a new access token",
          r.status_code == 200 and bool((r.json() or {}).get("access_token")),
          r.text[:200])
    r = client.post("/api/auth/refresh", json={"refresh_token": token})
    check("an access token is rejected by /refresh", r.status_code == 401)

    r = client.post("/api/auth/password/change", headers=auth, json={
        "current_password": "wrong-password", "new_password": "another-good-passphrase",
    })
    check("password change with wrong current is 403", r.status_code == 403)

    r = client.post("/api/auth/password/change", headers=auth, json={
        "current_password": password, "new_password": "another-good-passphrase",
    })
    check("password change succeeds", r.status_code == 200, r.text[:200])

    check("old password no longer works",
          client.post("/api/auth/login",
                      json={"email": email, "password": password}).status_code == 401)
    check("new password works",
          client.post("/api/auth/login",
                      json={"email": email,
                            "password": "another-good-passphrase"}).status_code == 200)

    # ── no account enumeration ───────────────────────────────
    section("no account enumeration")
    wrong = client.post("/api/auth/login",
                        json={"email": email, "password": "definitely-not-it"})
    missing = client.post("/api/auth/login",
                          json={"email": "ghost@insightpulse-qa.dev",
                                "password": "definitely-not-it"})
    check("wrong password and unknown email answer identically",
          wrong.status_code == missing.status_code
          and wrong.json().get("detail") == missing.json().get("detail"),
          f"{wrong.status_code}/{missing.status_code}")

    client.close()
    return report()


def report() -> int:
    print("\n" + "=" * 62)
    if failed:
        print(f"RESULT: {passed} passed, {len(failed)} FAILED")
        for name in failed:
            print(f"  - {name}")
        return 1
    print(f"RESULT: all {passed} checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
