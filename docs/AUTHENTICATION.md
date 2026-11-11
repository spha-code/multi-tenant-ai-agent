# Authentication — how Keycloak secures this app

How a login becomes a tamper-proof, self-carrying proof of *which tenant a request is for* — the seven steps from realm setup to tenant context.

> Related: [KEYCLOAK-REALM-CAPTURE.md](./KEYCLOAK-REALM-CAPTURE.md) covers how the realm configuration is captured and imported.

## The 7 steps

1. **Realm setup** — Keycloak starts with the `ai-portal` realm imported from committed files
2. **Login redirect** — frontend sends the user to Keycloak to authenticate
3. **Token issue** — Keycloak authenticates the user and issues a JWT
4. **Bearer header** — every API call carries that token
5. **Token extraction** — FastAPI dependency pulls the token out of the request
6. **Verification** — backend validates the JWT against Keycloak's public keys
7. **Tenant context** — verified claims become the request's tenant identity

---

## 1. Realm setup

Keycloak organizes everything inside a **realm** — a self-contained world with its own users, roles, and apps (you could run `realm-a` and `realm-b` completely isolated on one server). This repo commits its realm configuration as files, so on startup Keycloak imports `ai-portal` automatically — fresh-machine setup requires no manual clicking around Keycloak's admin console; the *definition* of the identity world is versioned in git like any other code. The realm defines which **clients** (registered applications allowed to log in — the frontend, the backend) exist and what secrets they use.

## 2. Login redirect

The app never sees or handles a password. When the user hits a protected page without a session, the frontend (or a redirect handler) bounces them to Keycloak's hosted login page: `keycloak:8080/realms/ai-portal/protocol/openid-connect/auth?client_id=…&redirect_uri=…`. The user types their credentials *into Keycloak's UI*, on Keycloak's domain. That separation is the core security win: password handling, brute-force protection, MFA — all live in one purpose-built service, and app code stays out of the credential business entirely.

## 3. Token issue

After successful login, Keycloak redirects back to the app with an authorization code, which the frontend exchanges for tokens (the OIDC **authorization-code flow** — the code is a one-time, short-lived voucher so the actual tokens never travel through the browser's URL). The important one is the **access token**: a **JWT** — a self-contained, digitally signed JSON blob that says *who* the user is (sub, username, email) and *what* they can do (roles, and in this app, tenant identity), plus *how long* it's valid (`exp`, typically ~5 minutes). "Self-contained" is the design trick: the token itself carries the proof of identity, so the backend doesn't need to call Keycloak on every request.

## 4. Bearer header

From now on, "I am who I am" means showing this token. Every API request from the frontend includes the HTTP header:

```
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

That's the entire wire protocol — stateless authentication. The backend keeps **no session store**: it doesn't remember logged-in users between requests; each request re-presents its own credential (the JWT). This is what makes the system horizontally scalable — no "sticky" sessions or shared login state between server instances.

## 5. Token extraction

In `backend/app/deps.py` (docstring: *"turns a Bearer token into a verified tenant identity"*), FastAPI's `HTTPBearer` dependency does the plumbing: it reads the `Authorization` header, checks it's actually a Bearer token, pulls out the JWT string, and hands it to the verification logic. Because it's a FastAPI **dependency**, every protected route just declares `user = Depends(...)` — authentication isn't scattered through the endpoints, it's one declared line per route, and the guard applies uniformly.

## 6. Verification

Anyone can *write* a JWT claiming "I'm admin" — the string is just base64-encoded JSON. The defense is the **signature**: Keycloak signs tokens with its **private key**, and the backend verifies with the matching **public key**, fetched from `http://keycloak:8080/realms/ai-portal/protocol/openid-connect/certs` (the JWKS endpoint — a JSON list of public keys). `backend/app/auth.py` caches those keys with a TTL (`JWKS_CACHE_TTL`) so it's not re-fetching every request, then `jwt.decode()` verifies four things in one call:

- **signature** — forged tokens are rejected
- **issuer** — the token must come from *this* Keycloak realm, not some other one
- **audience** — the token must be issued for *our* client, not another app (prevents cross-app token replay)
- **expiry** — stale tokens are rejected

Only if all four pass do the claims survive.

## 7. Tenant context

The verified claims become the request's **tenant identity** — the dependency returns a typed user/tenant object that the rest of the code takes as ground truth. This is where "multi-tenant" becomes real: every database query, every agent action, every file access scopes itself to that tenant — *the identity that a cryptographic signature just proved*. A user from tenant A physically cannot read tenant B's data, not because of an `if` check someone remembered to write, but because their verified token doesn't *contain* tenant B.

**The end state of the whole chain:** a login at step 2 becomes a tamper-proof, self-carrying proof of "which tenant is this request for" that every downstream line of code can rely on.
