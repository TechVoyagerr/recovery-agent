import { after } from "next/server";
import { createRun, executeRun } from "@/lib/simulator";
import { db } from "@/lib/db";
import { exclusive } from "@/lib/agent/service";
import { api, demoGuard } from "@/lib/http";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  return api(async () => {
    const guard = demoGuard(request);
    if (guard) return guard;
    const body = z
      .object({
        n: z.number().int().min(1).max(10000),
        seed: z.number().int().min(0).max(2147483647).default(42),
        speed: z.enum(["instant", "live"]).default("instant"),
      })
      .parse(await request.json());
    return exclusive(async () => {
      if (await db.simulationRun.count({ where: { status: "RUNNING" } }))
        return Response.json(
          { error: "A simulation is already running" },
          { status: 409 },
        );
      const run = await createRun(body.n, body.seed);
      after(() => executeRun(run.id, body.speed).then(() => {}));
      return Response.json({ runId: run.id, synthetic: true }, { status: 202 });
    });
  });
}
