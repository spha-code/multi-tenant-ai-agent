# Central configuration, loaded from environment variables (.env via docker-compose).
# Rule of this architecture: values that CHANGE how we run & who we trust live here,
# never in logic files.
import os

# ---- Database (connection goes AS app_user, so Postgres RLS applies) ----
APP_DB_NAME = os.environ.get("APP_DB_NAME", "app_db")
APP_DB_HOST = os.environ.get("APP_DB_HOST", "postgres")
APP_DB_PORT = int(os.environ.get("APP_DB_PORT", "5432"))
APP_DB_USER = os.environ.get("APP_DB_USER", "app_user")
APP_DB_PASSWORD = os.environ.get("APP_DB_PASSWORD", "")

# ---- Keycloak / OIDC ----
# The ISSUER is what Keycloak puts inside every token ("iss" claim).
# IMPORTANT: tokens carry the URL the USER's browser used (localhost:8080),
# while the backend fetches public keys over the docker network (keycloak:8080).
ISSUER = os.environ.get(
    "KEYCLOAK_ISSUER", "http://localhost:8080/realms/ai-engine"
)
JWKS_URL = os.environ.get(
    "KEYCLOAK_JWKS_URL",
    "http://keycloak:8080/realms/ai-engine/protocol/openid-connect/certs",
)
# Tokens are only accepted if "aud" contains the backend client id.
TOKEN_AUDIENCE = os.environ.get("TOKEN_AUDIENCE", "cloud-portal-backend")

# How long (seconds) we cache Keycloak's public keys before refreshing.
JWKS_CACHE_TTL = int(os.environ.get("JWKS_CACHE_TTL", "300"))
