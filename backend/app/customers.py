from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .deps import Principal, get_principal
from . import db

router = APIRouter(prefix="/customers", tags=["customers"])


class CustomerIn(BaseModel):
    name: str
    email: str


@router.get("")
def list_customers(principal: Annotated[Principal, Depends(get_principal)]):
    with db.tenant_session(principal.tenant_id) as conn:
        rows = conn.execute(
            "SELECT id, name, email, created_at FROM customers ORDER BY name"
        ).fetchall()
    return rows


@router.post("", status_code=201)
def create_customer(
    body: CustomerIn,
    principal: Annotated[Principal, Depends(get_principal)],
):
    # Note: no tenant_id comes from the request! The row's tenant is derived
    # from the session scope set by tenant_session (current_setting). If
    # anything coerced a foreign tenant in, RLS WITH CHECK would reject it.
    with db.tenant_session(principal.tenant_id) as conn:
        row = conn.execute(
            "INSERT INTO customers (tenant_id, name, email) "
            "VALUES (current_setting('app.tenant_id'), %s, %s) "
            "RETURNING id, name, email, created_at",
            (body.name, body.email),
        ).fetchone()
    return row
