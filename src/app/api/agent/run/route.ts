import { processPending } from "@/lib/agent/service";
import { api, demoGuard } from "@/lib/http";
export async function POST(request: Request) {
  return api(
    async () => demoGuard(request) ?? Response.json(await processPending()),
  );
}
