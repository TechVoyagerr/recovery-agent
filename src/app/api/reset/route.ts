import { reset } from "@/lib/seed";
import { recoverStaleRuns } from "@/lib/simulator";
import { exclusive } from "@/lib/agent/service";
import { clearLlmMemory } from "@/lib/agent/llm";
import { api, demoGuard } from "@/lib/http";
export async function POST(request: Request) {
  return api(async () => {
    const guard = demoGuard(request);
    if (guard) return guard;
    return exclusive(async () => {
      const activeRun = await recoverStaleRuns();
      if (activeRun)
        return Response.json(
          { error: `Cannot reset while simulation ${activeRun.id} is running (${activeRun.processed}/${activeRun.n} processed). Wait for it to finish.`, runId: activeRun.id },
          { status: 409 },
        );
      clearLlmMemory();
      return Response.json(await reset());
    });
  });
}
