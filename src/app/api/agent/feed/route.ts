import { db } from "@/lib/db";
import { api } from "@/lib/http";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return api(async () => {
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(200)
      .parse(new URL(request.url).searchParams.get("limit") ?? 50);
    return Response.json(
      await db.agentEvent.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit,
      }),
    );
  });
}
