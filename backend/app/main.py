from contextlib import asynccontextmanager
from typing import Annotated
import uvicorn

from fastapi import APIRouter, Depends, FastAPI

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.open_pool()
    yield
    db.close_pool()


app = FastAPI(title="Cloud Portal Backend", lifespan=lifespan)
app.include_router(router)
app.include_router(customers_router)
app.include_router(orders_router)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
