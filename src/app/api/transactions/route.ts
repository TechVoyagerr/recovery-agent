import { db } from "@/lib/db";
import { api } from "@/lib/http";
import { z } from "zod";
import { REASONS } from "@/lib/types";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return api(async () => {
    const raw = Object.fromEntries(new URL(request.url).searchParams);
    for (const k of Object.keys(raw)) if (raw[k] === "") delete raw[k];
    const q = z
      .object({
        status: z
          .enum(["FAILED", "RECOVERED", "PENDING_RECOVERY", "GIVEN_UP", "PAID"])
          .optional(),
        reason: z.enum(REASONS).optional(),
        channel: z.enum(["whatsapp", "sms", "email", "none"]).optional(),
        limit: z.coerce.number().int().min(1).max(200).default(50),
        cursor: z.string().optional(),
      })
      .parse(raw);
    if (
      q.cursor &&
      !(await db.transaction.findUnique({ where: { id: q.cursor } }))
    )
      return Response.json({ error: "Invalid cursor" }, { status: 400 });
    const items = await db.transaction.findMany({
      where: {
        status: q.status,
        failureReason: q.reason,
        ...(q.channel ? { attempts: { some: { channel: q.channel } } } : {}),
      },
      include: { customer: true, attempts: { orderBy: { attemptNo: "asc" } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = items.length > q.limit;
    if (hasMore) items.pop();
    return Response.json({
      items,
      nextCursor: hasMore ? items.at(-1)!.id : null,
    });
  });
}
