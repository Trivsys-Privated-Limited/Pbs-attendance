import "server-only";
import { getCookiePrincipal } from "../auth/admin-session";
import { getAuthService } from "../auth/container";
import { isBackendConfigured, requireServerEnv } from "../env";
import { createApiHandlers } from "./api-handlers";

/** Production API handlers, wired to Supabase. */
export function apiHandlers() {
  const configured = isBackendConfigured();
  return createApiHandlers({
    getService: () => (configured ? getAuthService() : null),
    trustProxyHeaders: configured ? requireServerEnv().TRUST_PROXY_HEADERS : false,
    cookiePrincipal: getCookiePrincipal,
  });
}
