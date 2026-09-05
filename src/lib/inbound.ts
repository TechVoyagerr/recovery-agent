import { z } from "zod";
import { db } from "./db";
import { exclusive } from "./agent/service";
import { demoGuard } from "./http";

const schema = z.object({ from: z.string().trim().min(3).max(200), text: z.string().trim().min(1).max(2000) });
const normalize = (value: string) => value.replace(/^whatsapp:/i, "").replace(/[\s()+.-]/g, "");

export async function inbound(request: Request) {
  // Production provider adapters must authenticate and forward with this bearer token.
  const denied = demoGuard(request);
  if (denied) return denied;
  const form = request.headers.get("content-type")?.includes("application/x-www-form-urlencoded");
  const body = form ? Object.fromEntries(new URLSearchParams(await request.text())) : await request.json();
  const { from, text } = schema.parse({ from: body.from ?? body.From, text: body.text ?? body.Body });
  if (!/^(STOP|UNSUBSCRIBE|BAND)$/i.test(text)) return Response.json({ ok: true, ignored: true });
  return exclusive(() => db.$transaction(async (p) => {
    const customers = (await p.customer.findMany()).filter((c) => normalize(c.phone) === normalize(from));
    const ids = customers.map((c) => c.id);
    await p.customer.updateMany({ where: { id: { in: ids } }, data: { optedOut: true } });
    const cancelled = await p.recoveryAttempt.updateMany({
      where: { transaction: { customerId: { in: ids } }, outcome: "PENDING" },
      data: { outcome: "CANCELLED" },
    });
    await p.transaction.updateMany({
      where: { customerId: { in: ids }, status: { in: ["FAILED", "PENDING_RECOVERY"] } },
      data: { status: "GIVEN_UP" },
    });
    await p.agentEvent.create({ data: {
      type: "OPT_OUT", title: "Customer requested no further messages",
      detail: { customerIds: ids, keyword: text.toUpperCase(), cancelled: cancelled.count },
    } });
    return Response.json({ ok: true, optedOut: customers.length > 0, cancelled: cancelled.count });
  }));
}
