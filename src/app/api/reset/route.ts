import { reset } from "@/lib/seed";
import { db } from "@/lib/db";
import { exclusive } from "@/lib/agent/service";
import { clearLlmMemory } from "@/lib/agent/llm";
import { api, demoGuard } from "@/lib/http";
export async function POST(request: Request) {
  return api(async () => {
    const guard = demoGuard(request);
    if (guard) return guard;
    return exclusive(async () => {
      if (await db.simulationRun.count({ where: { status: "RUNNING" } }))
        return Response.json(
          { error: "Wait for the active simulation before resetting" },
          { status: 409 },
        );
      clearLlmMemory();
      return Response.json(await reset());
    });
  });
}
