# Frontend Build Plan — multi-tenant-ai-agent

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

## Phase 1 — Scaffold & wiring

1. Create `frontend/` (Vite React-TS template)
2. `frontend/Dockerfile` (`npm run dev -- --host`) + `frontend/.dockerignore`
3. `docker-compose.yml`: add `frontend` service — `5173:5173`, bind-mount
   `./frontend:/app`, `VITE_*` environment variables
4. Backend: add CORS middleware allowing origin `http://localhost:5173`
5. Extend `.env.example`: `VITE_API_BASE_URL`, `VITE_OIDC_AUTHORITY`,
   `VITE_OIDC_CLIENT_ID`

## Phase 2 — Auth

6. `src/auth/` — OIDC login, redirect callback, silent renewal, logout
7. **One manual step (user):** create Keycloak **public client**
   `cloud-portal-frontend` in the `ai-engine` realm, redirect `http://localhost:5173/*`.
   Exact admin-console steps provided, or a realm-import JSON on request
8. 401 → automatic re-login redirect; 403 → friendly
   "not a member of any organization" screen

## Phase 3 — App shell & API layer

9. Layout: sidebar (Orders / Customers / Profile); header shows tenant name
   (from `GET /me`), user email, logout button
10. `src/api/` — typed endpoints for `/me`, `/customers`, `/orders`; Zod
    response validation

## Phase 4 — Pages

11. **Login** — redirects to Keycloak
12. **Customers** — table (name, email, created) + "Add customer" modal
    (name, email)
13. **Orders** — table (title, amount, status, customer, date) + create form
    with customer dropdown (maps list email → `customer_email`)
14. Loading / empty / error states for all pages

## Phase 5 — Verify the multi-tenancy story

15. Log in as users from two different organizations; each sees only their
    tenant's data — the UI-level proof of the Postgres RLS guarantee

## Later implementation (tracked, not forgotten)

- **AI agent chat UI** — streaming chat panel (SSE, markdown + citations);
  requires the backend `POST /agent` streaming endpoint first (pgvector is
  already in the stack, pointing that way)
- **Production build** — nginx-served static build (`vite build`) as a second
  Dockerfile target
- **Tests** — component and E2E coverage

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
