import { z } from "zod";

export const activityStateSchema = z.enum(["active", "idle"]);

/**
 * Shape of a desktop heartbeat (contract only, not wired up in Phase 1).
 * Deliberately minimal: presence state and app metadata ONLY.
 * The server stamps the authoritative time; any client time is informational.
 */
export const heartbeatPayloadSchema = z.strictObject({
  deviceId: z.uuid(),
  state: activityStateSchema,
  appVersion: z.string().max(32),
  clientSentAt: z.iso.datetime().optional(),
});
export type HeartbeatPayload = z.infer<typeof heartbeatPayloadSchema>;
