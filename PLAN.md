# Frontend Build Plan — multi-tenant-ai-portal

> **Status:** Phases 1–4 implemented and merged into `main` (PR #6).
> Phase 5 is a runtime verification, and the Keycloak
> public client is the one manual setup step remaining.
> Next: **agentic chat composer** plan below.

A web frontend ("Cloud Portal") for the existing FastAPI backend: Keycloak OIDC
login, tenant-scoped Customers and Orders, and proof that each user only sees
their own organization's data.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Stack | Vite + React + TypeScript |
| Auth | oidc-client-ts with PKCE (backend stays the only token verifier) |
| API access | Thin typed `fetch` wrapper, automatic Bearer header |
| Deployment | **Everything on Docker** — frontend runs `npm run dev` inside a container with bind-mount |
| UI goal | Very simple but beautiful; UX considered throughout |

## UX Principles

- One clear job per screen; no clutter, no settings nobody asked for.
- Persistent orientation: sidebar nav, tenant name + user email always visible,
  logout one click away.
- Every list has loading, empty, and error states — never a blank screen.
- Forms validate where the user is (basics) but stay server-authoritative on
  errors; failures appear as inline, human-readable messages.
- Optimistic-feeling interaction: gentle transitions, instant feedback on save.
- Design: clean typography, one accent color, generous spacing, rounded
  corners, subtle shadows — beautiful through restraint, not complexity.

## Phase 1 — Scaffold & wiring ✅

1. ✅ Create `frontend/` (Vite React-TS template)
2. ✅ `frontend/Dockerfile` (`npm run dev -- --host`) + `frontend/.dockerignore`
3. ✅ `docker-compose.yml`: add `frontend` service — `5173:5173`, bind-mount
   `./frontend:/app`, `VITE_*` environment variables
4. ✅ Backend: CORS middleware driven by `CORS_ORIGINS` (default `http://localhost:5173`)
5. ✅ Extend `.env.example`: `VITE_API_BASE_URL`, `VITE_OIDC_AUTHORITY`,
   `VITE_OIDC_CLIENT_ID`, `CORS_ORIGINS`

## Phase 2 — Auth ✅

6. ✅ `src/auth/` — OIDC login, redirect callback, silent renewal, logout
7. ⏳ **Manual step (user):** create Keycloak **public client**
   `cloud-portal-frontend` in the `ai-portal` realm, redirect `http://localhost:5173/*`
   (Clients → Create client → authentication OFF, standard flow ON,
   redirect `http://localhost:5173/*`, web origin `http://localhost:5173`)
8. ✅ 401 → automatic re-login redirect; 403 → friendly
   "not a member of any organization" screen

## Phase 3 — App shell & API layer ✅

9. ✅ Layout: sidebar (Orders / Customers / Profile); tenant **display name,
   tagline and theme color** come from a new `GET /tenant` endpoint
   (the `tenants`/`tenant_settings` tables already have read-all RLS policies),
   user email from `GET /me`, logout one click away
10. ✅ `src/api/` — typed endpoints for `/me`, `/tenant`, `/customers`,
    `/orders` with Zod response validation

## Phase 4 — Pages ✅

11. ✅ **Login** — redirects to Keycloak (callback at `/auth/callback`)
12. ✅ **Customers** — table (name, email, created) + "Add customer" modal
    (name, email)
13. ✅ **Orders** — table (title, amount, status badge, customer, date) +
    create form with customer dropdown (maps list email → `customer_email`)
14. ✅ Loading / empty / error states for all pages

## Phase 5 — Verify the multi-tenancy story ⏳ (verify at runtime)

15. ⏳ Log in as users from two different organizations (`companya` /
    `companyb` members); each sees only their tenant's data — the UI-level
    proof of the Postgres RLS guarantee. Factory reset requires a *fresh*
    postgres volume: `docker compose down -v` before first `docker compose up`.

## Later implementation (tracked, not forgotten)

- **Production build** — nginx-served static build (`vite build`) as a second
  Dockerfile target
- **Tests** — component and E2E coverage

## Active next plan — agentic chat composer

> **Status:** planned, not started. Lives on top of the existing
> Bearer-token → tenant → RLS pipeline, so the agent inherits tenant
> isolation for free: every tool call runs inside `tenant_session()`.
> pgvector is already provisioned but unused — this plan is what will use it.

### Concept

A chat composer in the portal where the user talks to an agent that can see
and act within **its own tenant's data**:

```text
"What did Raj order last month?"          → query_orders tool (read, auto-approved)
"Create an order for Lena, racking, 9k"   → create_order tool (write, confirm card)
```

The agent NEVER asks for or sees a tenant: it is the principal's tenant,
derived from the Keycloak `organization` claim exactly like every endpoint.

### Backend — `POST /agent/chat` (SSE)

- **Streaming**: FastAPI async generator; SSE separates *answer tokens* from
  *typed activity events* (tool calls, errors) so the FE renders them
  differently
- **Agent loop**: small tool loop, not a monolith:
  `query_customers`, `query_orders`, `create_order` (reuses existing endpoint
  semantics), each wrapped in `tenant_session(principal.tenant_id)`
- **Auth**: unchanged — same `get_principal` dependency
- **Conversation persistence**: `threads` + `messages` tables, RLS-tenant-scoped
- **Memory / RAG**: `embeddings` table (tenant_id + same RLS pattern) searched
  with pgvector via `set_config('app.tenant_id')` — tenant-scoped knowledge,
  no leakage

### Frontend — the composer

- New route `/chat`: message list with **streaming markdown**, working
  indicator, stop button
- Composer: send, queue-while-working, multi-line input
- **Tool activity rendering**: collapsed chips per tool call, expandable
- **Confirm-before-act**: write tools (e.g. `create_order`) render a card in
  the chat — "Create this order? [Confirm] / [Cancel]"
- Threads list in the sidebar, history loaded by `thread_id`

### Open decisions (made during implementation)

| Decision | Default until changed |
|---|---|
| LLM provider & key | env var, globally set; per-tenant `provider/model` in `tenant_settings` later |
| Read vs. write approval | reads auto-approved; writes require the confirm card |
| Thread retention | keep forever; compaction is a later problem |
| Errors | SSE `error` events rendered inline with a retry button |

### Phases (each step demoable on its own)

1. **BE** — `/agent/chat` with one read tool (`query_orders`) + SSE stream
   (curl-testable)
2. **FE** — minimal composer that receives the stream; render tokens + one
   activity chip
3. **BE+FE** — `create_order` tool with the confirm-card flow
4. **DB+BE+FE** — threads persistence + sidebar thread list
5. **DB+BE** — pgvector embeddings table (RLS) + RAG retrieval in the loop
6. **Polish** — stop/queue, markdown theming, mobile layout

## Running after build

```powershell
docker compose up -d
# open http://localhost:5173
```

Escape hatch (same result, dev server on your host):

```powershell
docker compose up -d postgres keycloak backend
cd frontend && npm install && npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| Keycloak | http://localhost:8080 |
| pgAdmin | http://localhost:5050 |
| Postgres | localhost:5432 |
