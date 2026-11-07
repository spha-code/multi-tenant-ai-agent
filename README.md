# multi-tenant-ai-agent

Multi-tenant AI agent. Each user's agent can only access their own company's data.

## Stack

| Layer      | Tech                                   |
|------------|----------------------------------------|
| Auth       | Keycloak 26.3 (one realm, Organizations per company) |
| Database   | PostgreSQL 16 (tenant_id + Row-Level Security, pgvector provisioned) |
| Backend    | FastAPI (Python)                       |
| Frontend   | Vite + React + TypeScript (oidc-client-ts) |
| AI agent   | planned — agentic chat composer (see [PLAN.md](PLAN.md)) |
| Local dev  | Docker Compose (frontend runs `npm run dev` in-container) |

## How the multi-tenancy works

- **One Keycloak realm** (`ai-engine`) hosts the app; each customer company is an
  **Organization** inside that realm. A user's login token carries the
  organization they belong to.
- **Every business table** carries a `tenant_id` column, and PostgreSQL
  **Row-Level Security (RLS)** filters all queries by the tenant of the request.
- The tenant **always comes from the verified Keycloak token**, never from the
  request body — and the AI agent runs its tools through the same
  tenant-scoped data access, so it can never "choose" a company itself.

## Local setup

Prerequisites: Docker Desktop (WSL2) installed and running.

1. Copy the environment template and adjust values if needed:

   ```bash
   cp .env.example .env
   ```

2. Start everything (Postgres, Keycloak, pgAdmin, backend **and** frontend):

   ```bash
   docker compose up -d
   ```

3. Verify Keycloak is up: open http://localhost:8080 and log into the
   Administration Console (credentials from `.env`).

   > **Fresh machine?** On a new volume Keycloak starts **empty** — the
   > `ai-engine` realm (organizations, test users, clients) exists only in
   > the machine where the stack was first set up. Capture it once and
   > commit it back: see [docs/KEYCLOAK-REALM-CAPTURE.md](docs/KEYCLOAK-REALM-CAPTURE.md).

4. **One-time Keycloak setup for the frontend** (public client for the
   browser app, PKCE flow):

   - **Clients → Create client**: `cloud-portal-frontend`,
     authentication OFF (public), standard flow ON
   - Valid redirect URIs: `http://localhost:5173/*`;
     web origins: `http://localhost:5173`
   - **Audience mapper** (required, or the backend rejects every token):
     Clients → `cloud-portal-frontend` → Client scopes →
     `cloud-portal-frontend-dedicated` → Mappers → Add →
     configuration → Audience → Included Client Audience:
     `cloud-portal-backend`

5. Open the portal at http://localhost:5173 and log in with an organization member.

## Services & ports

| URL                 | Service  | Notes                                        |
|---------------------|----------|----------------------------------------------|
| localhost:5432      | Postgres | database protocol (Postgres wire protocol)   |
| localhost:8080      | Keycloak | Administration Console (HTTP)                |
| localhost:5050      | pgAdmin  | web UI for browsing Postgres                 |
| localhost:8000      | FastAPI  | backend API (token check + tenant scope)     |
| localhost:5173      | Cloud Portal | Vite + React frontend (dev server)       |

## Backend API (step 4)

Endpoints (all require `Authorization: Bearer <token>`):

| Method | Path         | Purpose                                                    |
|--------|--------------|------------------------------------------------------------|
| GET    | `/me`        | identity summary (user, email, tenant from org claim)      |
| GET    | `/tenant`    | caller's tenant display info (name, tagline, theme color)  |
| GET/POST | `/customers` | list / create customers of the caller's tenant only       |
| GET/POST | `/orders`    | list / create orders of the caller's tenant only          |

Quick manual test (dev tokens for now, minted via the `poc-client` password grant):

```bash
TOKEN=$(curl -s -X POST "http://localhost:8080/realms/ai-engine/protocol/openid-connect/token" \
  -d "grant_type=password" -d "client_id=poc-client" \
  -d "username=alice@company-a.com" -d "password=123" -d "scope=openid" | jq -r .access_token)

curl -s http://localhost:8000/customers -H "Authorization: Bearer $TOKEN"
```

Bob (`bob@company-b.com`, same password) gets Company B rows from the same URL —
the tenant comes from the token, so the endpoint has zero tenant logic.

pgAdmin first-time setup: register the server with host `postgres`
(the Docker service name — *not* `localhost`), port `5432`,
user `keycloak`, password from `.env`.


## Roadmap

- [x] Step 1: Keycloak + Postgres via Docker Compose
- [x] Step 2: Organizations (Company A / B) + test users + app clients in Keycloak
- [x] Step 3: App database with tenant_id + Row-Level Security
- [x] Step 4: FastAPI backend validating tokens, applying tenant scope
- [x] Step 5: Frontend portal (Vite + React) with per-company branding —
      runtime step remaining: one-time Keycloak public client (see Local setup)
- [ ] Step 6: Agentic chat composer — planned in detail in [PLAN.md](PLAN.md)
- [ ] Step 7: Automated cross-tenant isolation tests
- [ ] Step 8: Deployment, billing, admin pages
        (Kubernetes migration groundwork: [PLAN-K8S.md](PLAN-K8S.md))

See also: [PLAN.md](PLAN.md) (agentic chat composer),
[PLAN-K8S.md](PLAN-K8S.md) (local Kubernetes learning plan),
[docs/KEYCLOAK-REALM-CAPTURE.md](docs/KEYCLOAK-REALM-CAPTURE.md)
(one-time Keycloak realm capture runbook).

## Handy commands

```bash
docker compose up -d      # start Keycloak + Postgres
docker compose stop       # stop without deleting data
docker compose down -v    # stop and wipe volumes (reset everything)
docker compose logs -f    # follow logs
```
