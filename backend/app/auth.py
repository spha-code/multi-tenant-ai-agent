"""Token verification.

Concepts (short recap):
- Keycloak signs every access token with its PRIVATE RSA key.
- Anyone holding the PUBLIC key (published at the JWKS URL) can verify
  signatures OFFLINE: no call to Keycloak per request, the backend only
  asks for the public keys and caches them.
- "kid" (key id) inside a token header tells us WHICH public key was used.
"""
import time

import jwt
import httpx
from jwt import PyJWTError
from jwt.algorithms import RSAAlgorithm

from . import config

_jwks_cache: dict = {}   # kid -> key
_jwks_fetched_at: float = 0.0


async def _get_public_key(kid: str):
    """Fetch Keycloak's public-key set, cache it for JWKS_CACHE_TTL seconds."""
    global _jwks_cache, _jwks_fetched_at
    if time.monotonic() - _jwks_fetched_at > config.JWKS_CACHE_TTL:
        async with httpx.AsyncClient() as client:
            resp = await client.get(config.JWKS_URL, timeout=10)
            resp.raise_for_status()
            _jwks_cache = {
                k["kid"]: RSAAlgorithm.from_jwk(k)
                for k in resp.json().get("keys", [])
            }
        _jwks_fetched_at = time.monotonic()
    if kid not in _jwks_cache:
        raise jwt.exceptions.InvalidKeyError(f"Unknown key id: {kid}")
    return _jwks_cache[kid]


async def verify_token(token: str) -> dict:
    """Verify signature, issuer, audience and expiry. Returns the claims."""
    try:
        header = jwt.get_unverified_header(token)
        key = await _get_public_key(header["kid"])
        return jwt.decode(
            token,
            key=key,
            algorithms=["RS256"],
            issuer=config.ISSUER,
            audience=config.TOKEN_AUDIENCE,
            options={"require": ["sub", "iss", "aud", "exp"]},
        )
    except PyJWTError as exc:
        raise jwt.exceptions.InvalidTokenError(str(exc))
