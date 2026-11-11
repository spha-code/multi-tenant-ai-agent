import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { userManager } from "../auth/userManager";
import { EmptyState, FullLoading } from "../components/States";

/**
 * Keycloak redirects here with the auth code; we finish the PKCE exchange.
 *
 * The auth code is single-use, so it must be redeemed exactly once. React
 * StrictMode double-invokes effects in development, which would otherwise
 * exchange the same code twice and fail with "Code not valid" (invalid_code).
 * Memoising the in-flight promise makes the second invocation await the first.
 */
let signInCallback: Promise<void> | null = null;

function completeSignIn(): Promise<void> {
  if (!signInCallback) {
    signInCallback = userManager.signinRedirectCallback().then(
      () => undefined,
      (err) => {
        // Allow a retry if the exchange genuinely failed.
        signInCallback = null;
        throw err;
      },
    );
  }
  return signInCallback;
}

export default function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    completeSignIn()
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
