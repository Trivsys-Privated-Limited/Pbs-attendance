import { apiHandlers } from "@/server/http/handlers";

export const dynamic = "force-dynamic";

export function GET(request: Request): Promise<Response> {
  return apiHandlers().me(request);
}
