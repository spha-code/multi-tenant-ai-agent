# Kubernetes Learning Plan — run this stack on a local cluster

> **Status:** draft — not started.
> Goal: reproduce the docker-compose stack as Kubernetes pods on THIS machine,
> as a safe simulation of the company setup (Docker → K8s → Rancher → Azure).
> No cloud account, no company infrastructure needed.

## Why

The docker-compose architecture ("one machine, five containers") does not
teach what the company stack actually was: containers orchestrated as pods by
Kubernetes, managed through Rancher, hosted on Azure. This plan rebuilds the
same repo locally so the concepts transfer 1:1 to what was seen at work.

## Concepts learned (the real point)

| Concept | docker-compose equivalent | Where it appears here |
|---|---|---|
| Cluster / Node | the whole PC | Docker Desktop's built-in k8s |
| Pod | one service's container | backend, keycloak, postgres... |
| Deployment | `services:` entry + `restart` | stateless pods (backend, frontend) |
| StatefulSet + PVC | named volume `postgres_data` | postgres with real persistence |
| Service + Ingress | `ports:` mapping | how NodePort/Ingress replaces published ports |
| Secret / ConfigMap | `.env` | env vars and DB password |
| Rancher | — (compose has no UI) | dashboard installed into the cluster |
| AKS / Azure | — | only in the optional final phase |

## Decisions (locked)

| Decision | Choice |
|---|---|
| Cluster | **Docker Desktop built-in Kubernetes** (Settings → Kubernetes → Enable) |
| Tooling | `kubectl` (bundled with Docker Desktop) + `helm` when needed |
| Scope | backend + postgres first; keycloak, then frontend, pgAdmin last |
| Rancher | Google/Rancher helm chart into the local cluster, NodePort access |
| Manifests | plain YAML under `k8s/` (no Helm for the app — learning the primitives) |
| Images | built locally via existing Dockerfiles (`image: app-backend:local`) |

## Phase 1 — Cluster bootstrap

1. ⏳ Enable Kubernetes in Docker Desktop; verify: `kubectl get nodes`
   (one node, `docker-desktop`, status Ready)
2. ⏳ Confirm resource budget in Docker Desktop settings (≥ 8 GB RAM for
   postgres + keycloak + pods simultaneously)
3. ⏳ Skim `kubectl` basics: `get pods`, `logs`, `describe`, `apply`, `delete`

## Phase 2 — Database spine (postgres first)

4. ⏳ `k8s/secret-db.yaml` — POSTGRES/APP_DB credentials from `.env` as Secret
5. ⏳ `k8s/postgres-statefulset.yaml` — pgvector/pg16 image, 1 replica,
   dataDirHostPath-backed PVC = the analogue of `postgres_data`
6. ⏳ `k8s/postgres-service.yaml` — ClusterIP `postgres:5432`
   (same DNS name as compose!, so backend config needs no changes)
7. ⏳ Init script run once: replicate `db/init/` via an `initContainer` or a
   one-off Job; verify `app_db` + RLS schema exist
8. ⏳ **Lesson check:** delete the pod, confirm data survives PVC (then
   delete the PVC deliberately → data gone; the compose `down -v` analogue)

## Phase 3 — Backend

9. ⏳ `docker build ./backend -t app-backend:local` (Docker Desktop's
   k8s can pull local images directly)
10. ⏳ `k8s/backend-deployment.yaml` — 2 replicas (never possible with this
    compose file: they share port 8000 without a Service),
    env from Secret/ConfigMap (KEYCLOAK_ISSUER, JWKS, CORS...)
11. ⏳ `k8s/backend-service.yaml` — exposed via NodePort 30080 as
    `http://localhost:30080` (the k8s replacement for `ports: 8000:8000`)
12. ⏳ **Lesson check:** `kubectl scale deployment backend --replicas=4`,
    watch pods appear/disappear; kill one, watch self-healing

## Phase 4 — Keycloak (the hardest: it's stateful + feature-flagged)

13. ⏳ Keycloak 26.3 Deployment with the same env vars as compose
    (`KC_DB: postgres`, `KC_FEATURES: organization`, bootstrapped admin
    from Secret)
14. ⏳ NodePort service on 30080...→ separate port (e.g. 30081), same story
    as compose's 8080
15. ⏳ **Known gap, already documented elsewhere:** the realm data exists
    only on the machine where the current compose volume lives.
    Either manual re-setup of realm/orgs/users, or a realm
    export→import into the cluster (branch: see README local setup)

## Phase 5 — Rancher dashboard

16. ⏳ Install Rancher into the cluster (helm chart, stable), NodePort 30082
17. ⏳ Werb-UI tour: find our pods, logs, restart ("rollback"), scale sliders —
    the same screens as at the company, but on data we own
18. ⏳ Delete a pod from the Rancher UI → watch k8s recreate it

## Phase 6 — Frontend & full flow

19. ⏳ Frontend Deployment (build stage → static; compose's bind-mount/HMR
    has no k8s equivalent — Lesson: dev-loop note, keep compose for dev)
20. ⏳ End-to-end test: login → tenant view → every request scoped via
    `organization` claim, same RLS guarantee as compose stack

## Phase 7 — Optional Azure bridge (only after everything above is green)

21. ⏳ (optional) Map local learnings to AKS terms: node pools, Azure LB,
    ACR (`az aks`, `az acr` CLI comparison table) — with a free/paid-light
    account; strictly reading & `--dry-run` first, billing metered

## Non-goals

- No `ingress-nginx`/TLS in the meaty phases (NodePorts are enough locally)
- No CI/CD or GitOps (Flux/Argo) — separate plan if desired
- Not a production-ready deployment; everything is `localhost` throughout
