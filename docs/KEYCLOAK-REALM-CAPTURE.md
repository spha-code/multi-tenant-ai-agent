# Keycloak realm capture — runbook (run on the machine WITH the data)

> **Status:** not executed yet. The realm (`ai-portal`, orgs, users,
> clients, audience mapper, password hashes) currently exists only in the
> `postgres_data` volume of the machine where the stack was first built.
> Git cannot carry it. This runbook moves it into the repo so that
> **any machine** gets an automatically populated realm on first
> `docker compose up`.

## Why this matters (the current gap)

- Compose/repo brings the *mechanics*, not the realm *state*:
  on a fresh machine Keycloak starts empty (only the `admin` bootstrap user)
- alice / bob / orgs / clients exist only as documentation — the accounts
  live in the old machine's volume and die with it

## Step 1 — Audit (one-time, machine with realm data)

Walk the admin console (http://localhost:8080) and record:
realm settings, clients (`cloud-portal-frontend`, `cloud-portal-backend`,
`poc-client`) + the audience mapper config, Organizations + members,
test users and their credential state. Put findings into the repo doc
(or refine this file) — the audit doc is the human-review layer.

## Step 2 — Export the realm (the real prize)

```bash
docker exec -it app_keycloak /opt/keycloak/bin/kc.sh export \
  --dir /tmp/export --users realm_file
docker cp app_keycloak:/tmp/export/realm-export-ai-portal.json .
```

Captures everything — orgs, users, clients, mapper, and even the
**password hashes** (so `alice` / `123` works identically elsewhere).
One JSON file.

## Step 3 — Make it automatic on any machine

Move the JSON into the repo as `keycloak/realm-export.json`, then in
`docker-compose.yml` for the `keycloak` service:

```yaml
command: start-dev --import-realm
volumes:
  - ./keycloak:/opt/keycloak/data/import:ro
```

Result: any machine that runs `docker compose up` on a fresh volume gets a
fully-populated realm automatically. Idempotent-ish (import is skipped when
the realm already exists) and officially supported by Keycloak.

## Step 4 — Commit & share

1. Commit `keycloak/realm-export.json` + this runbook (same or follow-up branch)
2. Push → the other machine pulls and now *sees the data documenting itself*
3. Cross-check the export against the Step-1 audit (orgs, mapper, members)
4. Note for later: this same JSON is the input for the missing realm in the
   Kubernetes plan (PLAN-K8S.md, Phase 4)

## Caveats

- The export contains password hashes + client secrets. Acceptable for this
  repo's dev-only data (`123` is already public in README); keep it out of git
  for real deployments.
- Export snapshot ≠ live: remember to re-export after manual realm changes,
  or the import will (correctly) leave an existing realm untouched.
