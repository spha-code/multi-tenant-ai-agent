#!/bin/bash
# =====================================================================
# Runs ONCE, automatically, on the FIRST boot of an empty Postgres
# data volume (docker-entrypoint-initdb.d). Never runs again afterwards.
#
# Creates:
#   - the application database "app_db" (separate from Keycloak's)
#   - a non-privileged login role for the FastAPI backend
#   - tenant metadata, business tables and agentic-echo tables later
#   - Row-Level Security policies (tenant isolation enforced by Postgres)
#   - sample data for both companies
# =====================================================================
set -euo pipefail

APP_DB="app_db"

# ---------------------------------------------------------------------
# 1) Application role (instance-wide, non-superuser).
#    The backend connects ONLY as this user, so RLS applies to it.
# ---------------------------------------------------------------------
APP_USER="$POSTGRES_APP_USER"
APP_PASS="$POSTGRES_APP_PASSWORD"

ROLE_EXISTS=$(psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${APP_USER}'")
if [ "$ROLE_EXISTS" != "1" ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" \
       -c "CREATE ROLE ${APP_USER} LOGIN PASSWORD '${APP_PASS}'"
  echo "Created role ${APP_USER}"
fi

# ---------------------------------------------------------------------
# 2) The application database (only if missing).
# ---------------------------------------------------------------------
DB_EXISTS=$(psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${APP_DB}'")
if [ "$DB_EXISTS" != "1" ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -c "CREATE DATABASE ${APP_DB} OWNER ${POSTGRES_USER}"
  echo "Created database ${APP_DB}"
fi

# pgvector for the agentic-embedding phase (per-database extension)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$APP_DB" -c "CREATE EXTENSION IF NOT EXISTS vector"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" \
     --dbname "$APP_DB" -c "GRANT CONNECT ON DATABASE app_db TO \"${APP_USER}\""

# ---------------------------------------------------------------------
# 3) Schema: tenant registry, business tables, RLS, grants.
#    current_setting('app.tenant_id', true) returns NULL when not set:
#    the comparison then filters ALL rows -> deny-by-default.
# ---------------------------------------------------------------------
psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" --dbname "$APP_DB" <<EOSQL
CREATE TABLE IF NOT EXISTS tenants (
    id            TEXT PRIMARY KEY,            -- Keycloak org alias, e.g. 'companya'
    legal_name    TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_settings (
    tenant_id     TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    display_name  TEXT NOT NULL,
    tagline       TEXT,
    theme_color   TEXT NOT NULL DEFAULT '#3B82F6',
    logo_url      TEXT
);

CREATE TABLE IF NOT EXISTS customers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     TEXT NOT NULL REFERENCES tenants(id),
    name          TEXT NOT NULL,
    email         TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS orders (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     TEXT NOT NULL REFERENCES tenants(id),
    customer_id   UUID NOT NULL REFERENCES customers(id),
    title         TEXT NOT NULL,
    amount        NUMERIC(10, 2) NOT NULL,
    status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'paid', 'shipped', 'cancelled')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;

-- Tenants/settings are readable by anyone (needed to build login screens)
CREATE POLICY tenants_read_all      ON tenants         FOR SELECT USING (TRUE);
CREATE POLICY tenant_settings_read  ON tenant_settings FOR SELECT USING (TRUE);

-- Business data: per-tenant. Read + write strictly inside own tenant.
CREATE POLICY customers_tenant_isolation ON customers
    USING      (tenant_id = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY orders_tenant_isolation ON orders
    USING      (tenant_id = current_setting('app.tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

GRANT USAGE ON SCHEMA public TO "${APP_USER}";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${APP_USER}";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${APP_USER}";
EOSQL

# ---------------------------------------------------------------------
# 4) Sample data (idempotent inserts)
# ---------------------------------------------------------------------
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$APP_DB" <<'EOSQL'
INSERT INTO tenants (id, legal_name) VALUES
    ('companya', 'Acme Manufacturing Ltd.'),
    ('companyb', 'Northwind Trade GmbH')
ON CONFLICT (id) DO NOTHING;

INSERT INTO tenant_settings (tenant_id, display_name, tagline, theme_color, logo_url) VALUES
    ('companya', 'Acme Manufacturing', 'Heavy parts, fast delivery', '#E23D28', '/logos/acme.png'),
    ('companyb', 'Northwind Trade',    'Global import & export hub', '#1E6E5C', '/logos/northwind.png')
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO customers (tenant_id, name, email) VALUES
    ('companya', 'Alice Harrison', 'harrison@acme-cust.com'),
    ('companya', 'Marcus Smith',   'smith@acme-cust.com'),
    ('companya', 'Dana Wills',     'wills@acme-cust.com'),
    ('companyb', 'Raj Mehta',      'raj@northwind-cust.com'),
    ('companyb', 'Lena Fischer',   'lena@northwind-cust.com'),
    ('companyb', 'Sam Cohen',      'sam@northwind-cust.com')
ON CONFLICT (tenant_id, email) DO NOTHING;

INSERT INTO orders (tenant_id, customer_id, title, amount, status) VALUES
    ('companya', (SELECT id FROM customers WHERE tenant_id = 'companya' AND email = 'harrison@acme-cust.com'), 'Hydraulic press 2200', 12400.00, 'paid'),
    ('companya', (SELECT id FROM customers WHERE tenant_id = 'companya' AND email = 'harrison@acme-cust.com'), 'Conveyor belt refit',   3080.50, 'shipped'),
    ('companya', (SELECT id FROM customers WHERE tenant_id = 'companya' AND email = 'smith@acme-cust.com'),   'Precision valve set',    990.00, 'open'),
    ('companya', (SELECT id FROM customers WHERE tenant_id = 'companya' AND email = 'wills@acme-cust.com'),   'Steel brackets x500',   2450.75, 'open'),
    ('companyb', (SELECT id FROM customers WHERE tenant_id = 'companyb' AND email = 'raj@northwind-cust.com'),    'Container shipment A', 18200.00, 'paid'),
    ('companyb', (SELECT id FROM customers WHERE tenant_id = 'companyb' AND email = 'raj@northwind-cust.com'),    'Customs brokerage',     650.00, 'open'),
    ('companyb', (SELECT id FROM customers WHERE tenant_id = 'companyb' AND email = 'lena@northwind-cust.com'),   'Warehouse racking',    9480.25, 'shipped'),
    ('companyb', (SELECT id FROM customers WHERE tenant_id = 'companyb' AND email = 'sam@northwind-cust.com'),    'Freight insurance',    1210.00, 'cancelled')
ON CONFLICT DO NOTHING;
EOSQL

echo "app_db bootstrap complete"
