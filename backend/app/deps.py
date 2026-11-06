"""HTTP plumbing: turns a Bearer token into a verified tenant identity."""
from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import auth

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class Principal:
    """The authenticated caller. Tenant NEVER comes from the HTTP request —
    it is read from the Keycloak-signed 'organization' claim inside the token."""
    user_id: str
    email: str | None
    tenant_id: str
    claims: dict


async def get_principal(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> Principal:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        claims = await auth.verify_token(credentials.credentials)
    except jwt.exceptions.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    orgs = claims.get("organization") or []
    if not orgs:
        raise HTTPException(status_code=403, detail="No organization membership in token")
    return Principal(
        user_id=claims["sub"],
        email=claims.get("email"),
        tenant_id=orgs[0],   # ["companya"] -> "companya"
        claims=claims,
    )
