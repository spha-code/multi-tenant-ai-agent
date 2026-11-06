import { createContext, useContext, useCallback, useEffect, useState, ReactNode } from "react";
import { fetchMe } from "../api/client";
import { api } from "../api/client";
import { Me, Tenant, TenantSchema } from "../api/types";

/**
 * Loads /me + /tenant once per session and exposes them everywhere.
 * /tenant gives the display name and theme color the shell is built around.
 */

interface TenantContextValue {
  me: Me | null;
  tenant: Tenant | null;
  error: string | null;
  /** Re-fetch both (e.g. after an unexpected 404/403 recovery). */
  reload: () => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setError(null);
    Promise.all([
      fetchMe(),
      api<unknown>("/tenant").then((raw) => TenantSchema.parse(raw)),
    ])
      .then(([meData, tenantData]) => {
        if (alive) {
          setMe(meData);
          setTenant(tenantData);
        }
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "Failed to load tenant");
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  return (
    <TenantContext.Provider value={{ me, tenant, error, reload }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used inside <TenantProvider>");
  return ctx;
}
