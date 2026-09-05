import { db } from "@/lib/db";
import { seed } from "@/lib/seed";
import {
  event,
  exclusive,
  planTransaction,
  dispatchAttempt,
} from "@/lib/agent/service";
import { api, demoGuard } from "@/lib/http";
import { REASONS } from "@/lib/types";
import { z } from "zod";
export async function POST(request: Request) {
  return api(async () => {
    const guard = demoGuard(request);
    if (guard) return guard;
    const body = z
      .object({
        amountPaise: z.number().int().min(100).max(100000000),
        reason: z.enum(REASONS),
        method: z.enum(["upi", "card", "netbanking", "wallet"]),
        customerId: z.string().optional(),
      })
      .parse(await request.json());
    return exclusive(async () => {
      await seed();
      const customer = body.customerId
        ? await db.customer.findUniqueOrThrow({
            where: { id: body.customerId },
          })
        : await db.customer.findUniqueOrThrow({
            where: { id: "customer_002" },
          });
      const tx = await db.transaction.create({
        data: {
          customerId: customer.id,
          merchantId: customer.merchantId,
          amountPaise: body.amountPaise,
          method: body.method,
          failureReason: body.reason,
          isDemo: true,
        },
      });
      await event(
        "DETECTED",
        "Demo payment failure detected",
        { reason: body.reason, amountPaise: body.amountPaise },
        tx.id,
      );
      const planned = await planTransaction(tx.id, { llm: true });
      for (const a of planned.attempts)
        await dispatchAttempt(a.id, { mock: true });
      return Response.json(
        await db.transaction.findUnique({
          where: { id: tx.id },
          include: { customer: true, attempts: true },
        }),
        { status: 201 },
      );
    });
  });
}
