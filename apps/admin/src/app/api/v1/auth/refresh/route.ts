import { apiHandlers } from "@/server/http/handlers";

export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return apiHandlers().refresh(request);
}
