import { db } from "../db";
import { Prisma } from "@prisma/client";
import { decide } from "./rules";
import { polish } from "./llm";
import { createPaymentLink, getNotifier } from "../payments";
import { FailureReason, PaymentMethod } from "../types";
export async function event(
  type: string,
  title: string,
  detail: Prisma.InputJsonValue,
  transactionId?: string,
  createdAt?: Date,
) {
  return db.agentEvent.create({
    data: { type, title, detail, transactionId, createdAt },
  });
}
// Serialize work in one long-lived Node process, including overlapping HTTP requests.
const globalLock = globalThis as unknown as { recoveryLock?: Promise<unknown> };
export async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const previous = globalLock.recoveryLock ?? Promise.resolve();
  const next = previous.catch(() => {}).then(fn);
  globalLock.recoveryLock = next.catch(() => {});
  return next;
}
export async function planTransaction(
  id: string,
  options: { llm?: boolean; now?: Date; attemptNo?: number } = {},
) {
  const tx = await db.transaction.findUniqueOrThrow({
    where: { id },
    include: { customer: true, attempts: true },
  });
  if (["RECOVERED", "PAID", "GIVEN_UP"].includes(tx.status)) return tx;
  const attemptNo = options.attemptNo ?? 1;
  if (tx.attempts.some((a) => a.attemptNo === attemptNo)) return tx;
  let decision = decide({
    reason: tx.failureReason as FailureReason,
    method: tx.method as PaymentMethod,
    amountPaise: tx.amountPaise,
    customer: tx.customer,
    now: options.now,
    attemptNo,
    learning: await db.learningStat.findMany(),
  });
  if (options.llm)
    decision = await polish(decision, {
      reason: tx.failureReason,
      method: tx.method,
      amountPaise: tx.amountPaise,
      ...tx.customer,
    });
  await db.$transaction(async (p) => {
    await p.recoveryAttempt.create({
      data: {
        ...decision,
        scheduledAt: new Date(decision.scheduledAt),
        transactionId: id,
        attemptNo,
        outcome: decision.channel === "none" ? "EXPIRED" : "PENDING",
      },
    });
    await p.transaction.update({
      where: { id },
      data: {
        status: decision.channel === "none" ? "GIVEN_UP" : "PENDING_RECOVERY",
      },
    });
    await p.agentEvent.create({
      data: {
        type: "DECIDED",
        title:
          decision.channel === "none"
            ? "Outreach suppressed"
            : "Recovery strategy selected",
        detail: { ...decision },
        transactionId: id,
      },
    });
  });
  return db.transaction.findUniqueOrThrow({
    where: { id },
    include: { customer: true, attempts: true },
  });
}
export async function dispatchAttempt(
  id: string,
  options: { mock?: boolean; now?: Date } = {},
) {
  const a = await db.recoveryAttempt.findUniqueOrThrow({
    where: { id },
    include: { transaction: { include: { customer: true } } },
  });
  const now = options.now ?? new Date();
  if (
    a.sentAt ||
    a.outcome !== "PENDING" ||
    a.scheduledAt > now ||
    ["PAID", "RECOVERED", "GIVEN_UP"].includes(a.transaction.status)
  )
    return;
  if (a.transaction.customer.optedOut) {
    await db.recoveryAttempt.update({
      where: { id },
      data: { outcome: "EXPIRED" },
    });
    await db.transaction.update({
      where: { id: a.transactionId },
      data: { status: "GIVEN_UP" },
    });
    await event(
      "SUPPRESSED",
      "Customer opted out before delivery",
      {},
      a.transactionId,
    );
    return;
  }
  let paymentLinkId = a.paymentLinkId,
    paymentLinkUrl = a.paymentLinkUrl;
  if (!paymentLinkId || !paymentLinkUrl) {
    const link = await createPaymentLink({
      id: a.id,
      transactionId: a.transactionId,
      amountPaise: a.transaction.amountPaise,
      name: a.transaction.customer.name,
      phone: a.transaction.customer.phone,
      email: a.transaction.customer.email,
      mock:
        options.mock || a.transaction.isDemo || !!a.transaction.simulationRunId,
    });
    paymentLinkId = link.id;
    paymentLinkUrl = link.url;
    await db.recoveryAttempt.update({
      where: { id },
      data: { paymentLinkId, paymentLinkUrl },
    });
  }
  const message = a.message.replaceAll("{{link}}", paymentLinkUrl);
  const notifier = getNotifier();
  await notifier.send({
    channel: a.channel,
    to:
      a.channel === "email"
        ? a.transaction.customer.email
        : a.transaction.customer.phone,
    message,
    idempotencyKey: a.id,
  });
  await db.$transaction(async (p) => {
    await p.recoveryAttempt.update({
      where: { id },
      data: { sentAt: now, message },
    });
    await p.messageEvent.create({
      data: {
        attemptId: id,
        channel: a.channel,
        message,
        provider: notifier.name,
        createdAt: now,
      },
    });
    await p.agentEvent.create({
      data: {
        type: "MESSAGE_SENT",
        title: `${a.channel} recovery reminder sent`,
        detail: { attemptId: id, paymentLinkUrl, provider: notifier.name },
        transactionId: a.transactionId,
      },
    });
  });
}
export async function settleAttempt(
  id: string,
  recovered: boolean,
  now = new Date(),
  proof?: { paymentLinkId: string; paymentId?: string; synthetic?: boolean },
) {
  return db.$transaction(async (p) => {
    const a = await p.recoveryAttempt.findUniqueOrThrow({
      where: { id },
      include: { transaction: true },
    });
    if (recovered && (!proof || !a.paymentLinkId || proof.paymentLinkId !== a.paymentLinkId ||
      (proof.synthetic && !a.transaction.isDemo && !a.transaction.simulationRunId))) return false;
    if (
      (a.outcome !== "PENDING" && !(recovered && ["FAILED", "CANCELLED"].includes(a.outcome))) ||
      !a.sentAt ||
      ["PAID", "RECOVERED"].includes(a.transaction.status)
    )
      return false;
    await p.recoveryAttempt.update({
      where: { id },
      data: {
        outcome: recovered ? "RECOVERED" : "FAILED",
        attribution: recovered ? (proof?.synthetic ? "SIMULATED_LINK" : "PAYMENT_LINK") : null,
        recoveredPaymentId: recovered ? proof?.paymentId : null,
        recoveredAt: recovered ? now : null,
      },
    });
    await p.transaction.update({
      where: { id: a.transactionId },
      data: {
        status: recovered
          ? "RECOVERED"
          : a.transaction.failureReason === "CART_ABANDONED" &&
              a.attemptNo === 1
            ? "PENDING_RECOVERY"
            : "GIVEN_UP",
        recoveredAt: recovered ? now : null,
      },
    });
    if (recovered)
      await p.recoveryAttempt.updateMany({
        where: {
          transactionId: a.transactionId,
          id: { not: id },
          outcome: "PENDING",
        },
        data: { outcome: "EXPIRED" },
      });
    const key = {
      reason: a.transaction.failureReason,
      channel: a.channel,
      timingBucket: a.timingBucket,
    };
    await p.learningStat.upsert({
      where: { reason_channel_timingBucket: key },
      create: {
        ...key,
        successes: recovered ? 1 : 0,
        failures: recovered ? 0 : 1,
      },
      update: recovered
        ? {
            successes: { increment: 1 },
            ...(a.outcome === "FAILED" ? { failures: { decrement: 1 } } : {}),
          }
        : { failures: { increment: 1 } },
    });
    await p.agentEvent.create({
      data: {
        type: recovered ? "RECOVERED" : "ATTEMPT_FAILED",
        title: recovered ? "Payment recovered" : "Recovery did not convert",
        detail: {
          attemptId: id,
          attribution: recovered ? (proof?.synthetic ? "SIMULATED_LINK" : "PAYMENT_LINK") : null,
          amountPaise: a.transaction.amountPaise,
          channel: a.channel,
        },
        transactionId: a.transactionId,
      },
    });
    return true;
  });
}
export async function processPending() {
  return exclusive(async () => {
    let processed = 0;
    const now = new Date();
    for (const tx of await db.transaction.findMany({
      where: { status: "FAILED", simulationRunId: null },
    })) {
      await planTransaction(tx.id);
      processed++;
    }
    for (const a of await db.recoveryAttempt.findMany({
      where: {
        outcome: "PENDING",
        sentAt: null,
        scheduledAt: { lte: now },
        transaction: { simulationRunId: null, status: "PENDING_RECOVERY" },
      },
    })) {
      try {
        await dispatchAttempt(a.id);
        processed++;
      } catch {
        await event(
          "ACTION_ERROR",
          "Payment link or notification failed; retry pending",
          { attemptId: a.id },
          a.transactionId,
        );
      }
    }
    for (const a of await db.recoveryAttempt.findMany({
      where: {
        outcome: "PENDING",
        sentAt: { lte: new Date(now.getTime() - 24 * 3600000) },
        transaction: { simulationRunId: null, status: "PENDING_RECOVERY" },
      },
    }))
      await settleAttempt(a.id, false, now);
    for (const tx of await db.transaction.findMany({
      where: {
        status: "PENDING_RECOVERY",
        failureReason: "CART_ABANDONED",
        simulationRunId: null,
      },
      include: { attempts: true },
    }))
      if (tx.attempts.length === 1 && tx.attempts[0].outcome === "FAILED") {
        await planTransaction(tx.id, { attemptNo: 2, now: tx.createdAt });
        processed++;
      }
    return { processed };
  });
}
