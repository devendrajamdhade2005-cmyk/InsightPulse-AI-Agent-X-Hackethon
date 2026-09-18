# InsightPulse AI

Autonomous research & competitive intelligence agent. It tracks research papers,
patent filings, competitor activity, industry news and the live web — decides where
to look, reads what it finds, and delivers a prioritized briefing with the
reasoning attached.

Two deployables, one repository:

```
.
├── backend/     FastAPI + LangGraph agent, auth, persistence   → Railway
└── frontend/    React + Vite + Tailwind dashboard             → Vercel
```

---

## Team

- **Team Leader:** Devendra Jamdhade
- Sanika Dighe · Prachi Bhujbal · Shruti Sadgir · Snehal Ranade

---

## Quick start (local)

Two terminals. The frontend dev server proxies `/api` and `/health` to the
backend, so no CORS setup and no environment variables are needed locally.

**Terminal 1 — backend**

```bash
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt      # Windows
# .venv/bin/pip install -r requirements.txt        # macOS / Linux
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```

**Terminal 2 — frontend**

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually <http://localhost:5173>).

| URL | What it is |
|---|---|
| `/` | Landing page |
| `/how-it-works` | Architecture explainer |
| `/signup` → `/app` | The workspace |
| `localhost:8000/docs` | OpenAPI / Swagger |
| `localhost:8000/health` | Capability report — which reasoner, sources and store are live |

No API keys are required to start. Providers without a key serve clearly labelled
synthetic data, and the UI always states which parts were live.

---

## Architecture

### backend/ — FastAPI

```
backend/
├── app/
│   ├── main.py            app factory, CORS, hardening middleware, /health
│   ├── config.py          settings; every key optional
│   ├── api/               agent · graph · evaluation · observability · report
│   │                      · auth · account  (62 endpoints)
│   ├── agents/            ReAct loop, orchestrator, specialists, planner
│   ├── graph/             LangGraph StateGraph runtime
│   ├── memory/            task context · working · long-term
│   ├── evaluation/        benchmark suite, metrics, baselines
│   ├── observability/     tracing, root-cause analysis, improvement loop
│   ├── auth/              bcrypt, JWT sessions, Firebase integration
│   ├── store/             Firestore primary, SQLite fallback
│   ├── tools/             5 tools over 13 providers
│   └── sources/           provider connectors + retry/breaker
├── tests/                 237 tests
├── Procfile               Railway start command
└── railway.json           Railway build/deploy config
```

### frontend/ — React 19 + Vite 8 + Tailwind 4

```
frontend/
├── src/
│   ├── pages/             Landing · HowItWorks · AuthPages · Dashboard · Account
│   ├── components/
│   │   ├── layout/        sidebar rail, topbar, system drawer
│   │   ├── views/         the 10 workspace sections
│   │   ├── charts/        isometric 3D charts (no WebGL dependency)
│   │   ├── reports/       3D page-turn report preview
│   │   ├── ui/            primitives + loading states
│   │   └── icons/         one vector icon vocabulary
│   ├── state/             Theme · Auth · Run providers
│   ├── hooks/             reveal-on-scroll, count-up, agent run
│   └── lib/               api client, derivations, formatting
└── vercel.json            SPA rewrites + asset caching
```

**Design system.** One palette, two surface treatments on a deliberate spectrum:
the marketing pages are neo-brutalist (hard outlines, offset shadows), the
workspace is macOS-style glass (vibrancy, hairlines, soft radii). A
`[data-surface="glass"]` scope *redefines* the shared class names, so a component
written once renders correctly in either treatment. The landing page walks the
reader from one end to the other, so arriving at the dashboard feels like the same
product turning down the volume.

---

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full walkthrough and the exact
environment variables to paste into Railway and Vercel.

Short version:

| | Platform | Root directory | Notes |
|---|---|---|---|
| Backend | Railway | `backend` | Start command comes from `railway.json` |
| Frontend | Vercel | `frontend` | Set `VITE_API_BASE` to the Railway URL |

After both are up, add the Vercel domain to `CORS_ORIGINS` on Railway and
redeploy — otherwise the browser blocks every API call.

---

## Testing

```bash
cd backend
.venv/Scripts/python -m pytest tests -q          # 237 tests
.venv/Scripts/python scripts/e2e_check.py        # 45 end-to-end checks
```

`e2e_check.py` exercises the whole authenticated path against a running server —
register, profile, saved/tracked, a real agent run, history round-trip, report
generation, token lifecycle and tenancy isolation. It runs in simulation mode, so
it spends no API quota.

```bash
cd frontend
npm run build
```

---

## Security notes

- `.env`, `*.db` and any `*firebase-adminsdk*.json` are gitignored. **Never commit
  a service-account key** — it grants full project access including every user
  record.
- `SECRET_KEY` signs session tokens. Generate a real one for production.
- `AGENT_API_TOKEN` is unset by default so the local demo needs no setup. Set it
  before exposing the service publicly: the run endpoints spend LLM quota and make
  outbound requests.
- Rate limits, a global concurrency cap and a request-body cap protect the metered
  endpoints. See `app/api/guard.py`.
