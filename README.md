# multi-tenant-ai-agent

Multi-tenant AI agent. Each user's agent can only access their own company's data.

## Stack

| Layer      | Tech                                   |
|------------|----------------------------------------|
| Auth       | Keycloak 26.3 (one realm, Organizations per company) |
| Database   | PostgreSQL 16 (tenant_id + Row-Level Security) |
| Backend    | FastAPI (Python)                       |
| Frontend   | Next.js                                |
| AI agent   | Claude API with company-filtered tools |
| Local dev  | Docker Compose                         |

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

2. Start the infrastructure:

   ```bash
   docker compose up -d
   ```

3. Verify Keycloak is up: open http://localhost:8080 and log into the
   Administration Console (admin / admin from `.env`).

## Services & ports

| URL                 | Service  | Notes                                        |
|---------------------|----------|----------------------------------------------|
| localhost:5432      | Postgres | database protocol (Postgres wire protocol)   |
| localhost:8080      | Keycloak | Administration Console (HTTP)                |
| localhost:5050      | pgAdmin  | web UI for browsing Postgres                 |
| localhost:8000      | FastAPI  | backend API (token check + tenant scope)     |
| localhost:3000      | Next.js  | frontend (later)                             |

## Backend API (step 4)

Endpoints (all require `Authorization: Bearer <token>`):

| Method | Path         | Purpose                                                    |
|--------|--------------|------------------------------------------------------------|
| GET    | `/me`        | identity summary (user, email, tenant from org claim)      |
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
- [ ] Step 5: Next.js frontend with per-company branding
- [ ] Step 6: Claude AI agent with tenant-scoped tools
- [ ] Step 7: Automated cross-tenant isolation tests
- [ ] Step 8: Deployment, billing, admin pages

## Handy commands

```bash
docker compose up -d      # start Keycloak + Postgres
docker compose stop       # stop without deleting data
docker compose down -v    # stop and wipe volumes (reset everything)
docker compose logs -f    # follow logs
```
