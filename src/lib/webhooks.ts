import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { classifyFailure } from "./agent/classifier";
import {
  dispatchAttempt,
  event,
  exclusive,
  planTransaction,
  settleAttempt,
} from "./agent/service";
const entity = z
  .object({
    id: z.string().optional(),
    order_id: z.string().nullable().optional(),
    amount: z.number().int().positive().optional(),
    amount_paid: z.number().int().optional(),
    currency: z.string().optional(),
    method: z.string().optional(),
    email: z.string().nullable().optional(),
    contact: z.string().nullable().optional(),
    error_code: z.string().nullable().optional(),
    error_reason: z.string().nullable().optional(),
    error_source: z.string().nullable().optional(),
    error_step: z.string().nullable().optional(),
    error_description: z.string().nullable().optional(),
    notes: z
      .union([z.record(z.string(), z.unknown()), z.array(z.unknown())])
      .optional(),
  })
  .passthrough();
const schema = z.object({
  event: z.string(),
  created_at: z.number().optional(),
  payload: z.record(z.string(), z.object({ entity })),
});
export async function webhook(request: Request) {
  const raw = await request.text();
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret)
    return Response.json(
      {
        error:
          "Webhook secret not configured; use /api/demo/fail for mock events",
      },
      { status: 503 },
    );
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const expected = createHmac("sha256", secret).update(raw).digest();
  if (
    !/^[a-f0-9]{64}$/i.test(signature) ||
    !timingSafeEqual(expected, Buffer.from(signature, "hex"))
  )
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  const body = schema.parse(JSON.parse(raw));
  const receipt =
    request.headers.get("x-razorpay-event-id") ??
    createHash("sha256").update(raw).digest("hex");
  return exclusive(async () => {
    if (await db.webhookReceipt.findUnique({ where: { id: receipt } }))
      return Response.json({ ok: true, duplicate: true });
    const payment = body.payload.payment?.entity;
    const order = body.payload.order?.entity;
    const link = body.payload.payment_link?.entity;
    const subscription = body.payload.subscription?.entity;
    const supported = [
      "payment.failed",
      "order.paid",
      "payment.captured",
      "payment_link.paid",
      "subscription.charged",
      "subscription.halted",
    ];
    if (!supported.includes(body.event))
      return Response.json({ ok: true, ignored: true });
    const notes = link?.notes ?? payment?.notes;
    const noteId =
      notes && !Array.isArray(notes) && typeof notes.transactionId === "string"
        ? notes.transactionId
        : undefined;
    const attempt = link?.id
      ? await db.recoveryAttempt.findUnique({
          where: { paymentLinkId: link.id },
        })
      : null;
    const orderId = payment?.order_id ?? order?.id;
    const matches = [
      ...(noteId ? [{ id: noteId }] : []),
      ...(attempt ? [{ id: attempt.transactionId }] : []),
      ...(payment?.id ? [{ razorpayPaymentId: payment.id }] : []),
      ...(orderId ? [{ razorpayOrderId: orderId }] : []),
    ];
    let tx = matches.length
      ? await db.transaction.findFirst({
          where: attempt ? { id: attempt.transactionId } : { OR: matches },
          include: { attempts: true },
        })
      : null;
    const success = [
      "order.paid",
      "payment.captured",
      "payment_link.paid",
      "subscription.charged",
    ].includes(body.event);
    if (body.event === "subscription.halted" && !payment) {
      await event(
        "SUBSCRIPTION_HALTED",
        "Subscription halted: payment context required",
        {
          subscriptionId: subscription?.id ?? null,
          reason:
            "No amount or customer payment supplied; manual reconciliation required",
        },
      );
    } else {
      if (!tx) {
        const amount =
          payment?.amount ?? order?.amount_paid ?? link?.amount_paid;
        if (!amount || amount <= 0)
          return Response.json(
            { error: "Payment amount required" },
            { status: 400 },
          );
        if (
          [payment?.currency, order?.currency, link?.currency].some(
            (c) => c && c !== "INR",
          )
        )
          return Response.json(
            { error: "Only INR supported" },
            { status: 400 },
          );
        const merchant = await db.merchant.upsert({
          where: { id: "merchant_demo" },
          create: { id: "merchant_demo", name: "Chai Point Demo Store" },
          update: {},
        });
        const phone = payment?.contact ?? "",
          email = payment?.email ?? "";
        let customer =
          phone || email
            ? await db.customer.findFirst({
                where: {
                  merchantId: merchant.id,
                  OR: [
                    ...(phone ? [{ phone }] : []),
                    ...(email ? [{ email }] : []),
                  ],
                },
              })
            : null;
        customer ??= await db.customer.create({
          data: {
            merchantId: merchant.id,
            name: "Customer",
            phone,
            email,
            city: "",
            language: "en",
            segment: "new",
          },
        });
        const reason = success ? "NONE" : classifyFailure(payment ?? {});
        tx = await db.transaction.create({
          data: {
            merchantId: merchant.id,
            customerId: customer.id,
            amountPaise: amount,
            method: ["upi", "card", "netbanking", "wallet"].includes(
              payment?.method ?? "",
            )
              ? payment!.method!
              : "upi",
            status: success ? "PAID" : "FAILED",
            failureReason: reason,
            razorpayOrderId: orderId,
            razorpayPaymentId: payment?.id,
            errorCode: payment?.error_code,
            errorDescription: payment?.error_description,
          },
          include: { attempts: true },
        });
      }
      if (success && [payment?.currency, order?.currency, link?.currency].some((c) => c && c !== "INR"))
        return Response.json({ error: "Only INR supported" }, { status: 400 });
      const paidAmount =
        payment?.amount ?? link?.amount_paid ?? order?.amount_paid;
      if (success && paidAmount !== undefined && paidAmount !== tx.amountPaise)
        return Response.json(
          { error: "Paid amount does not match transaction" },
          { status: 409 },
        );
      if (success && tx.status !== "PAID" && tx.status !== "RECOVERED") {
        // Only a provider-confirmed recovery link earns recovery credit.
        // Original payment/order success is organic settlement, even after a nudge.
        if (attempt && attempt.transactionId === tx.id && link?.id &&
            paidAmount === tx.amountPaise && attempt.sentAt &&
            ["PENDING", "FAILED", "CANCELLED"].includes(attempt.outcome))
          await settleAttempt(attempt.id, true, new Date(), {
            paymentLinkId: link.id, paymentId: payment?.id,
          });
        else {
          await db.transaction.update({
            where: { id: tx.id },
            data: { status: "PAID", recoveredAt: null },
          });
          await event("PAID_ORIGINAL", "Payment settled without recovery attribution", {}, tx.id);
          await db.recoveryAttempt.updateMany({
            where: { transactionId: tx.id, outcome: "PENDING" },
            data: { outcome: "EXPIRED" },
          });
        }
      }
      if (!success && tx.status === "FAILED") {
        await planTransaction(tx.id);
        const due = await db.recoveryAttempt.findMany({
          where: {
            transactionId: tx.id,
            sentAt: null,
            outcome: "PENDING",
            scheduledAt: { lte: new Date() },
          },
        });
        for (const a of due) await dispatchAttempt(a.id);
      }
      await event(
        "WEBHOOK_RECEIVED",
        body.event,
        { paymentId: payment?.id ?? null, orderId: orderId ?? null },
        tx.id,
      );
    }
    await db.webhookReceipt.create({ data: { id: receipt } });
    return Response.json({ ok: true });
  });
}
