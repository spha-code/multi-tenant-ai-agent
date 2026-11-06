import { UserManager, WebStorageStateStore } from "oidc-client-ts";

export const OIDC_AUTHORITY =
  import.meta.env.VITE_OIDC_AUTHORITY ||
  "http://localhost:8080/realms/ai-portal";
export const OIDC_CLIENT_ID =
  import.meta.env.VITE_OIDC_CLIENT_ID || "cloud-portal-frontend";

/**
 * Public (browser) client, PKCE code flow. The backend stays the only place
 * tokens are VERIFIED; the frontend just carries the token around.
 */
export const userManager = new UserManager({
  authority: OIDC_AUTHORITY,
  client_id: OIDC_CLIENT_ID,
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: "code",
  scope: "openid profile email",
  // persist auth state across the Keycloak redirect round-trip
  userStore: new WebStorageStateStore({ store: window.localStorage }),
});
