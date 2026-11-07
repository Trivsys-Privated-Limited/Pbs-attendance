import "server-only";
import { readServerConfig, type ServerConfig } from "./config";

export { isDemoPreviewAllowed } from "./config";
export type ServerEnv = ServerConfig;

export class BackendNotConfiguredError extends Error {
  constructor(problem: string) {
    super(`Supabase backend is not configured. ${problem}`);
    this.name = "BackendNotConfiguredError";
  }
}

export function isBackendConfigured(): boolean {
  return readServerConfig().config !== null;
}

export function requireServerEnv(): ServerEnv {
  const result = readServerConfig();
  if (!result.config) throw new BackendNotConfiguredError(result.problem);
  return result.config;
}
