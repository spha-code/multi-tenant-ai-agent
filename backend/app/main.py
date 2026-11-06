from contextlib import asynccontextmanager
from typing import Annotated
import uvicorn

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .deps import Principal, get_principal
from . import config, db
from .customers import router as customers_router
from .orders import router as orders_router

router = APIRouter(tags=["identity"])


@router.get("/me")
def me(principal: Annotated[Principal, Depends(get_principal)]):
    """Who am I? The frontend will use this to render the company's screen."""
    return {
        "user_id": principal.user_id,
        "email": principal.email,
        "tenant": principal.tenant_id,
    }


@router.get("/tenant")
def tenant(principal: Annotated[Principal, Depends(get_principal)]):
    """Public display info about the caller's tenant (name, tagline, theme).

    tenants/tenant_settings deliberately have read-all RLS policies; the
    lookup is still scoped to the caller's tenant for defense in depth.
    """
    with db.tenant_session(principal.tenant_id) as conn:
        row = conn.execute(
            """
            SELECT t.id, t.legal_name, s.display_name, s.tagline, s.theme_color
            FROM tenants t
            LEFT JOIN tenant_settings s ON s.tenant_id = t.id
            WHERE t.id = current_setting('app.tenant_id', true)
            """
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return row


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.open_pool()
    yield
    db.close_pool()


app = FastAPI(title="Cloud Portal Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=False,   # auth travels via Bearer token, not cookies
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(customers_router)
app.include_router(orders_router)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
