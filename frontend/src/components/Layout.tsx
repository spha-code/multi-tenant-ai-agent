import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { TenantProvider, useTenant } from "../hooks/useTenant";
import { FullLoading, EmptyState } from "./States";

function Sidebar() {
  const { me, tenant, error } = useTenant();
  const { user, signOut } = useAuth();

  const displayName = tenant?.display_name ?? tenant?.legal_name ?? me?.tenant ?? "Cloud Portal";

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-dot" style={tenant ? { background: tenant.theme_color } : undefined} />
        <div>
          <div className="brand-name">{displayName}</div>
          {tenant?.tagline && <div className="brand-tagline">{tenant.tagline}</div>}
        </div>
      </div>

      <nav style={{ display: "grid", gap: 4 }}>
        <NavLink to="/orders" className="nav-link">
          <span className="icon" aria-hidden>🧾</span> Orders
        </NavLink>
        <NavLink to="/customers" className="nav-link">
          <span className="icon" aria-hidden>👥</span> Customers
        </NavLink>
        <NavLink to="/profile" className="nav-link">
          <span className="icon" aria-hidden>🪪</span> Profile
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user" title={me?.email ?? undefined}>
          {me?.email || user?.profile?.email || "Signed in"}
        </div>
        <button className="btn btn-danger-ghost" style={{ justifyContent: "flex-start", padding: "6px 10px" }} onClick={() => void signOut()}>
          <span aria-hidden>⏻</span> Sign out
        </button>
        {error && <div className="sidebar-user" style={{ color: "var(--danger)" }}>{error}</div>}
      </div>
    </aside>
  );
}

function Shell() {
  return (
    <div className="shell">
      <Sidebar />
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

/**
 * App shell. If /me or /tenant can't be loaded (e.g. the token belongs to a
 * user with no organization membership behind it), show a friendly screen
 * instead of an empty shell.
 */
export default function Layout() {
  return (
    <TenantProvider>
      <ShellWithGuard />
    </TenantProvider>
  );
}

function ShellWithGuard() {
  const { me, error } = useTenant();

  if (error && !me) {
    return (
      <EmptyState
        icon="🚫"
        title="No organization membership on your account"
        hint="Your token was valid, but this backend could not resolve an organization for it. Ask a Keycloak admin to add you to an organization, then try signing in again."
      />
    );
  }

  if (!me) {
    return <FullLoading label="Loading your workspace…" />;
  }

  return (
    <Shell />
  );
}
