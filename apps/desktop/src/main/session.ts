import type { EmployeeSummary, LoginOutcome, SessionEndReason } from "../preload/channels";
import type { ApiClient, SessionTokens } from "./api-client";

/**
 * Employee session held in MAIN-process memory only. Tokens are never sent to the
 * renderer and never written to disk in Phase 2 (signing in again after an app restart is
 * required). The session is refreshed shortly before the access token expires; if refresh
 * fails (expired, revoked or suspended account) the session ends.
 */
export interface SessionManagerOptions {
  api: ApiClient;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  onEnded: (reason: SessionEndReason) => void;
}

const REFRESH_MARGIN_MS = 60_000;
const MIN_DELAY_MS = 5_000;

export function createSessionManager(opts: SessionManagerOptions) {
  const now = opts.now ?? Date.now;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let state: { employee: EmployeeSummary; tokens: SessionTokens } | null = null;
  let timer: unknown = null;

  function schedule() {
    if (timer !== null) clearTimer(timer);
    timer = null;
    if (!state) return;
    const delay = Math.max(MIN_DELAY_MS, state.tokens.expiresAt * 1000 - now() - REFRESH_MARGIN_MS);
    timer = setTimer(() => void refreshNow(), delay);
  }

  function end(reason: SessionEndReason) {
    if (timer !== null) clearTimer(timer);
    timer = null;
    const wasSignedIn = state !== null;
    state = null;
    if (wasSignedIn) opts.onEnded(reason);
  }

  async function refreshNow(): Promise<boolean> {
    if (!state) return false;
    const result = await opts.api.refresh(state.tokens.refreshToken);
    if (!result) {
      end("expired");
      return false;
    }
    state = result;
    schedule();
    return true;
  }

  return {
    async login(input: unknown): Promise<LoginOutcome> {
      const { outcome, tokens } = await opts.api.login(input);
      if (outcome.ok && tokens) {
        state = { employee: outcome.employee, tokens };
        schedule();
      }
      return outcome;
    },
    async logout(): Promise<void> {
      const tokens = state?.tokens;
      if (timer !== null) clearTimer(timer);
      timer = null;
      state = null;
      if (tokens) await opts.api.logout(tokens.accessToken);
    },
    current(): EmployeeSummary | null {
      return state?.employee ?? null;
    },
    refreshNow,
  };
}

export type SessionManager = ReturnType<typeof createSessionManager>;
