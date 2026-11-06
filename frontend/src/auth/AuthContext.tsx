import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "oidc-client-ts";
import { userManager } from "./userManager";

/** Tiny hand-rolled auth context around oidc-client-ts. */

interface AuthContextValue {
  user: User | null;
  /** True once the stored session (if any) has been resolved. */
  ready: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    // Restore any existing session (localStorage).
    userManager
      .getUser()
      .then((u) => {
        if (alive) {
          setUser(u);
          setReady(true);
        }
      })
      .catch(() => {
        if (alive) setReady(true);
      });

    const onLoaded = (u: User) => setUser(u);
    const onUnloaded = () => setUser(null);

    // Keep the token fresh; on renew failure send the user to Keycloak again.
    const renew = () => {
      userManager.signinSilent().catch((err) => {
        console.warn("Silent token renewal failed, going to login", err);
        userManager.signinRedirect().catch(() => undefined);
      });
    };

    userManager.events.addUserLoaded(onLoaded);
    userManager.events.addUserUnloaded(onUnloaded);
    userManager.events.addAccessTokenExpiring(renew);
    userManager.events.addSilentRenewError(renew);

    return () => {
      alive = false;
      userManager.events.removeUserLoaded(onLoaded);
      userManager.events.removeUserUnloaded(onUnloaded);
      userManager.events.removeAccessTokenExpiring(renew);
      userManager.events.removeSilentRenewError(renew);
    };
  }, []);

  const value: AuthContextValue = {
    user,
    ready,
    signIn: () => userManager.signinRedirect(),
    signOut: () => userManager.signoutRedirect(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
