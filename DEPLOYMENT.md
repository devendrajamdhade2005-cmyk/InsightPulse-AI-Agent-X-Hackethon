# Deployment

Backend on **Railway**, frontend on **Vercel**. Deploy the backend first — the
frontend needs its URL.

> **Before you start:** every credential that has been shared in a chat, screenshot
> or commit must be rotated. Paste only freshly generated values below.

**Live URLs for this project**

| | URL |
|---|---|
| Frontend (Vercel) | `https://insightpulse-ai.vercel.app` |
| Backend (Railway) | `https://insightpulse-ai-production.up.railway.app` |

So the two values that must be set, in full:

```env
# Vercel  (Project → Settings → Environment Variables)
VITE_API_BASE=https://insightpulse-ai-production.up.railway.app

# Railway (Variables tab)
CORS_ORIGINS=https://insightpulse-ai.vercel.app
```

---

## ⚠ Read this first: which Railway URL to use

Railway gives every service **two** hostnames, and they are not interchangeable.

| Hostname | Reachable from | Use it for |
|---|---|---|
| `insightpulse-ai.railway.internal` | **only inside your Railway project** | service→service calls (app → database) |
| `insightpulse-ai-production.up.railway.app` | **the public internet** | anything a browser talks to |

`*.railway.internal` is Railway's private IPv6 network. A browser cannot resolve
it, and neither can Vercel — neither is inside your Railway project. Pointing
`VITE_API_BASE` at the internal host gives you a site that loads but where **every
API call fails**, with `ERR_NAME_NOT_RESOLVED` in the console and the dashboard
stuck on "Backend offline".

So: **`VITE_API_BASE` must be the public `*.up.railway.app` domain.**

Get it from Railway → your service → **Settings → Networking → Public Networking →
Generate Domain**. If nothing is listed there, no public domain exists yet and the
backend is not reachable from the internet at all.

For this project that domain is already generated:

```
https://insightpulse-ai-production.up.railway.app
```

---

## 1. Backend → Railway

### Create the service

1. Railway → **New Project** → **Deploy from GitHub repo** → pick this repo.
2. Open the service → **Settings**:
   - **Root Directory:** `backend`
   - **Build:** leave as Nixpacks (auto-detected from `requirements.txt`)
   - **Start Command:** leave blank — `railway.json` supplies it
3. **Settings → Networking → Generate Domain.** Copy it, e.g.
   `https://insightpulse-ai-production.up.railway.app`

Railway injects `$PORT`; the start command in `railway.json` already binds
`0.0.0.0:$PORT`. `/health` is configured as the healthcheck.

### Railway environment variables

**Variables** tab → **Raw Editor** → paste, then fill in the blanks.

```env
# ── core ──────────────────────────────────────────────────────────
APP_ENV=production

# Generate a real one:
#   python -c "import secrets; print(secrets.token_urlsafe(48))"
SECRET_KEY=PASTE_A_48_BYTE_RANDOM_STRING

# The BROWSER's origin ? your Vercel domain. Not the backend's own address.
# No trailing slashes. Comma-separated, no spaces.
CORS_ORIGINS=https://insightpulse-ai.vercel.app

ACCESS_TOKEN_TTL_MINUTES=10080

# Protects the metered run endpoints. Leave blank to keep the demo open.
AGENT_API_TOKEN=

# ── reasoning ─────────────────────────────────────────────────────
LLM_PROVIDER=gemini
GEMINI_API_KEY=YOUR_NEW_GEMINI_KEY
GEMINI_MODEL=gemini-3.5-flash
LLM_RUN_BUDGET_USD=0.50
LLM_DAILY_BUDGET_USD=5.00

# ── agent behaviour ───────────────────────────────────────────────
SIMULATION_MODE=false
SCHEDULER_ENABLED=false
SEED_ON_STARTUP=false

# ── data sources (all optional; blank = clearly-labelled simulated) ──
TAVILY_API_KEY=YOUR_NEW_TAVILY_KEY
NEWSAPI_KEY=YOUR_NEW_NEWSAPI_KEY
NEWSDATA_API_KEY=YOUR_NEW_NEWSDATA_KEY
SERPAPI_KEY=YOUR_NEW_SERPAPI_KEY
GITHUB_TOKEN=YOUR_NEW_GITHUB_TOKEN
SEMANTIC_SCHOLAR_API_KEY=YOUR_NEW_S2_KEY
PATENTSVIEW_API_KEY=
GNEWS_API_KEY=

# ── identity & persistence ────────────────────────────────────────
FIREBASE_ENABLED=true
FIREBASE_PROJECT_ID=verify-insightpulse-ai
FIRESTORE_ENABLED=true

# Railway has no file upload, so paste the WHOLE service-account JSON on ONE
# line. Open the .json, remove the newlines, keep the \n escapes inside
# "private_key" exactly as they are.
FIREBASE_CREDENTIALS_JSON={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n", ...}

# REQUIRED for Firebase email/password sign-in.
# Firebase console → Project settings → General → "Web API Key".
# Without it the app still works, but verifies passwords against a local bcrypt
# hash and reports that honestly at /health.
FIREBASE_WEB_API_KEY=YOUR_FIREBASE_WEB_API_KEY

# Only used if FIRESTORE_ENABLED=false. Railway's filesystem is ephemeral, so
# SQLite data is LOST on redeploy — use Firestore in production.
DATABASE_URL=sqlite:///./data/insightpulse.db

ALLOW_REGISTRATION=true
PASSWORD_MIN_LENGTH=8
HISTORY_RETENTION_PER_USER=100

# ── observability ─────────────────────────────────────────────────
OBSERVABILITY_ENABLED=true
TRACE_EXPORT_ENABLED=false
```

### Getting `FIREBASE_CREDENTIALS_JSON` onto one line

```bash
# macOS / Linux
python3 -c "import json;print(json.dumps(json.load(open('service-account.json'))))"
```

```powershell
# Windows PowerShell
(Get-Content service-account.json -Raw | ConvertFrom-Json | ConvertTo-Json -Compress)
```

Copy the output verbatim as the value. Do not wrap it in extra quotes.

### Verify

```bash
curl https://insightpulse-ai-production.up.railway.app/health
```

Check these fields:

| Field | Expected |
|---|---|
| `store.backend` | `firestore` |
| `store.degraded` | **absent** — if present, Firestore is unreachable and it fell back to SQLite |
| `identity.password_verification` | `firebase` (or `local` if you left the Web API Key blank) |
| `reasoner` | `gemini` |
| `capabilities.keyed_sources` | `true` for each key you set |

---

## 2. Frontend → Vercel

### Create the project

1. Vercel → **Add New** → **Project** → import this repo.
2. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite (auto-detected)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

`frontend/vercel.json` already handles SPA rewrites — without them a hard refresh
on `/app/overview` would 404 — plus immutable asset caching and security headers.

### Vercel environment variables

Only one is required. **Settings → Environment Variables**, applied to
Production, Preview and Development:

```env
VITE_API_BASE=https://insightpulse-ai-production.up.railway.app
```

That is the public `*.up.railway.app` domain — **not**
`insightpulse-ai.railway.internal`, which a browser cannot reach. See the warning
at the top of this file.

Rules that bite people:

- **No trailing slash.** `https://x.up.railway.app` — not `.../`
- Must be `https://`
- Vite inlines `VITE_*` at **build** time, so changing it requires a **redeploy**,
  not just a restart
- Only `VITE_`-prefixed variables reach the browser. That is also why no secret
  ever belongs here — anything in the frontend bundle is public. The backend URL
  is public by design; provider keys stay on Railway.

### Then close the CORS loop

Go back to Railway and set `CORS_ORIGINS` to your real Vercel domain:

```env
CORS_ORIGINS=https://insightpulse-ai.vercel.app
```

Vercel also gives every deployment a unique preview URL. Those are separate
origins, so add them if you want previews working:

```env
CORS_ORIGINS=https://insightpulse-ai.vercel.app,https://insightpulse-ai-git-main-devendrajamdhade2005-cmyk.vercel.app
```

Redeploy the Railway service. Until you do, the browser will block every API call
and the dashboard will show "Backend offline".

---

## 3. Post-deploy checklist

- [ ] The Railway service has a **public** domain (Settings -> Networking)
- [ ] `GET https://insightpulse-ai-production.up.railway.app/health` returns `200`
      with `store.backend: firestore`
- [ ] No `store.degraded` message in `/health`
- [ ] Vercel site loads the landing page
- [ ] `/how-it-works` survives a hard refresh (proves the SPA rewrites work)
- [ ] Sign-up creates an account and lands on `/app/overview`
- [ ] Browser devtools → Network shows API calls going to the Railway domain with
      `200`, not CORS errors
- [ ] A scan completes and then appears under **Scan history**
- [ ] Sign out, sign back in — the history is still there (proves Firestore
      persistence rather than in-memory state)
- [ ] Firebase console → Firestore shows a `users` collection

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| "Backend offline" in the UI | `VITE_API_BASE` wrong/missing, or the Vercel domain is not in `CORS_ORIGINS` |
| `ERR_NAME_NOT_RESOLVED` on API calls | `VITE_API_BASE` points at `*.railway.internal`. Use the public `*.up.railway.app` domain |
| CORS error in console | `CORS_ORIGINS` has a trailing slash, `http://` instead of `https://`, or Railway was not redeployed after the change |
| 404 on refresh at `/app/...` | Vercel Root Directory is not `frontend`, so `vercel.json` was not picked up |
| `store.backend: sqlite` when you set Firestore | Read `store.degraded` in `/health` — it names the actual error. Usually malformed `FIREBASE_CREDENTIALS_JSON` |
| Sign-in fails with "Identity provider unavailable" | `FIREBASE_WEB_API_KEY` is set but wrong, or Email/Password sign-in is disabled in Firebase → Authentication → Sign-in method |
| History empty after redeploy | You are on SQLite. Railway's disk is ephemeral — set `FIRESTORE_ENABLED=true` |
| Agent says "heuristic reasoner" | `GEMINI_API_KEY` missing or rejected. The agent still works; it just reasons deterministically and says so |

---

## Local `.env` files

Neither is committed — both are gitignored.

**`backend/.env`** — copy `backend/.env.example` and fill in what you have.
Everything is optional; with nothing set the agent still runs end to end.

**`frontend/.env`** — usually unnecessary. `npm run dev` proxies the API to
`127.0.0.1:8000`, so leave `VITE_API_BASE` unset locally. Only set it if you want
the dev server to talk to the deployed backend instead.
