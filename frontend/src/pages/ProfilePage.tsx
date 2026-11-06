import { useAuth } from "../auth/AuthContext";
import { useTenant } from "../hooks/useTenant";

export default function ProfilePage() {
  const { me, tenant } = useTenant();
  const { user, signOut } = useAuth();

  if (!me) return null;

  const tenantLabel = tenant?.display_name ?? tenant?.legal_name ?? me.tenant;

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Profile</h1>
        <div className="page-sub">Let's see who you are in this workspace</div>
      </div>

      <div className="profile-grid">
        <div className="card profile-item">
          <div className="k">Email</div>
          <div className="v">{me.email || user?.profile?.email || "—"}</div>
        </div>
        <div className="card profile-item">
          <div className="k">Organization (tenant)</div>
          <div className="v">
            {tenantLabel} <span className="cell-muted">· {me.tenant}</span>
          </div>
        </div>
        <div className="card profile-item">
          <div className="k">User ID (sub)</div>
          <div className="v">{me.user_id}</div>
        </div>
        <div className="card profile-item">
          <div className="k">Session</div>
          <div className="v" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="tenant-badge" style={{ background: undefined, color: "#166534" }}>
              Valid JWT
            </span>
            <span className="cell-muted">verified offline by the backend via Keycloak's JWKS</span>
          </div>
        </div>
      </div>

      <div className="card profile-item" style={{ color: "var(--muted)" }}>
        <div className="k" style={{ color: "var(--text)" }}>
          How tenant isolation works
        </div>
        <div style={{ marginTop: 8, lineHeight: 1.7 }}>
          Your organization membership lives inside your signed access token as an
          <em> organization</em> claim. The backend trusts only that claim — never the request —
          and every database query is scoped to your tenant, where Postgres Row-Level Security
          does the final enforcement. You literally cannot ask for another company's data.
        </div>
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
