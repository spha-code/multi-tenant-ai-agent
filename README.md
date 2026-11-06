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

## Roadmap

- [x] Step 1: Keycloak + Postgres via Docker Compose
- [ ] Step 2: Organizations (Company A / B) + test users in Keycloak
- [ ] Step 3: App database with tenant_id + Row-Level Security
- [ ] Step 4: FastAPI backend validating tokens, applying tenant scope
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
