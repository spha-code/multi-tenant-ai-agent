"""Database access.

Critical pattern for multi-tenancy:
- ONE shared connection pool for all tenants (cheap, efficient).
- EVERY request opens a transaction and, inside it, scopes the tenancy with
    SELECT set_config('app.tenant_id', :tenant, true)
  The third argument `true` = LOCAL: the setting is UNDONE when the request's
  transaction ends, so a pooled connection is never "contaminated" by a
  previous request's tenant.
- From that instant, Postgres RLS does the isolation. The app code contains
  no WHERE tenant_id filters at all — the database enforces them.
"""
from contextlib import contextmanager
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row

from . import config

pool = ConnectionPool(
    conninfo=(
        f"host={config.APP_DB_HOST} port={config.APP_DB_PORT} "
        f"dbname={config.APP_DB_NAME} user={config.APP_DB_USER} "
        f"password={config.APP_DB_PASSWORD} application_name=ai-portal-backend"
    ),
    open=False,          # opened explicitly in app startup (lifespan)
    max_size=10,         # reused across requests; set_config(true) keeps them clean
    name="tenant-pool",
    # per-connection settings forwarded to psycopg.connect()
    kwargs={"row_factory": dict_row},  # rows come back as {"name": ...} dicts
)


def open_pool() -> None:
    pool.open()


def close_pool() -> None:
    pool.close()


@contextmanager
def tenant_session(tenant_id: str):
    """Yield a connection whose transaction is scoped to one tenant."""
    with pool.connection() as conn:
        with conn.transaction():
            conn.execute(
                "SELECT set_config('app.tenant_id', %s, true)", (tenant_id,)
            )
            yield conn
