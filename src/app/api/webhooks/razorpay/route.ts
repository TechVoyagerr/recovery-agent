import { webhook } from "@/lib/webhooks";
import { api } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(() => webhook(request));
}
