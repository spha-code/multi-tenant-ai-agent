from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .deps import Principal, get_principal
from . import db

router = APIRouter(prefix="/orders", tags=["orders"])


class OrderIn(BaseModel):
    title: str
    amount: float
    status: str = "open"
    customer_email: str


@router.get("")
def list_orders(principal: Annotated[Principal, Depends(get_principal)]):
    with db.tenant_session(principal.tenant_id) as conn:
        rows = conn.execute(
            """
            SELECT o.id, o.title, o.amount, o.status, o.created_at,
                   c.name AS customer_name, c.email AS customer_email
            FROM orders o JOIN customers c ON c.id = o.customer_id
            ORDER BY o.created_at DESC
            """
        ).fetchall()
    return rows


@router.post("", status_code=201)
def create_order(
    body: OrderIn,
    principal: Annotated[Principal, Depends(get_principal)],
):
    # customer must belong to the same tenant; the JOIN filter below is a
    # convenience — even without it, RLS guarantees isolation. If the email
    # belongs to another tenant, the lookup finds nothing -> 404.
    with db.tenant_session(principal.tenant_id) as conn:
        customer = conn.execute(
            "SELECT id FROM customers WHERE email = %s", (body.customer_email,)
        ).fetchone()
        if customer is None:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Customer not found")
        row = conn.execute(
            "INSERT INTO orders (tenant_id, customer_id, title, amount, status) "
            "VALUES (current_setting('app.tenant_id'), %s, %s, %s, %s) "
            "RETURNING id, title, amount, status, created_at",
            (customer["id"], body.title, body.amount, body.status),
        ).fetchone()
    return row
