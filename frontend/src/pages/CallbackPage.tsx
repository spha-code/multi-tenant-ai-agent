import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { userManager } from "../auth/userManager";
import { EmptyState, FullLoading } from "../components/States";

/** Keycloak redirects here with the auth code; we finish the PKCE exchange. */
export default function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    userManager
      .signinRedirectCallback()
      .then(() => {
        if (alive) navigate("/", { replace: true });
      })
      .catch((err: unknown) => {
        if (alive) {
          // Common case: landing here without an auth-state (fresh page load).
          console.warn("Sign-in callback failed", err);
          setError(err instanceof Error ? err.message : "Sign-in failed");
        }
      });
    return () => {
      alive = false;
    };
  }, [navigate]);

  if (error) {
    return (
      <EmptyState
        icon="😕"
        title="Sign-in didn't complete"
        hint={error || undefined}
      />
    );
  }

  return <FullLoading label="Signing you in…" />;
}
