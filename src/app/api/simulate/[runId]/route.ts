import { db } from "@/lib/db";
import { api } from "@/lib/http";
export async function GET(
  _r: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  return api(async () =>
    Response.json(
      { synthetic: true, ...await db.simulationRun.findUniqueOrThrow({
        where: { id: (await params).runId },
      }) },
    ),
  );
}
