import { inbound } from "@/lib/inbound";
import { api } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(() => inbound(request));
}
