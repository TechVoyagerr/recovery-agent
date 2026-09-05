import { db } from "./db";
import { seed as seedData } from "./seed";
import {
  event,
  planTransaction,
  dispatchAttempt,
  settleAttempt,
  exclusive,
} from "./agent/service";
import { BASE_RATES } from "./agent/rules";
import { FailureReason, REASONS } from "./types";
export function seededRandom(seed: number) {
  let a = seed | 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function outcomeProbability(
  reason: FailureReason,
  channel: string,
  timing: string,
  attemptNo: number,
) {
  return Math.min(
    0.95,
    BASE_RATES[reason] *
      (channel === "whatsapp"
        ? 1
        : channel === "sms"
          ? 0.84
          : channel === "email"
            ? 0.66
            : 0) *
      (attemptNo === 2 ? 0.36 : 1) *
      (reason === "INSUFFICIENT_FUNDS" && timing !== "salary" ? 0.5 : 1),
  );
}
export async function createRun(n: number, seed = 42) {
  await seedData();
  return db.simulationRun.create({ data: { n, seed } });
}
export async function executeRun(
  runId: string,
  speed: "instant" | "live" = "instant",
) {
  const run = await db.simulationRun.findUniqueOrThrow({
    where: { id: runId },
  });
  const rng = seededRandom(run.seed);
  const customers = await db.customer.findMany({ orderBy: { id: "asc" } });
  const start = Date.now();
  // Fixed virtual epoch keeps salary-window outcomes reproducible across calendar dates.
  const base = new Date("2026-07-27T00:00:00.000Z");
  try {
    await event("SIMULATION_STARTED", "Recovery simulation started", {
      runId,
      n: run.n,
      seed: run.seed,
      speed,
    });
    for (let i = 0; i < run.n; i++) {
      if (speed === "live") {
        const delay = start + (i / run.n) * 60000 - Date.now();
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      }
      await exclusive(async () => {
        const reason = REASONS[Math.floor(rng() * REASONS.length)];
        const customer = customers[Math.floor(rng() * customers.length)];
        const method = reason.startsWith("CARD")
          ? "card"
          : reason === "UPI_APP_ERROR"
            ? "upi"
            : ["upi", "card", "netbanking", "wallet"][Math.floor(rng() * 4)];
        const amountPaise = (99 + Math.floor(rng() * 4901)) * 100;
        const createdAt = new Date(
          base.getTime() + Math.floor(rng() * 7 * 86400000),
        );
        // Pre-draw outcome randomness so decisions and DB IDs cannot change the PRNG sequence.
        const draws = [rng(), rng(), rng(), rng()];
        const tx = await db.transaction.create({
          data: {
            merchantId: customer.merchantId,
            customerId: customer.id,
            amountPaise,
            method,
            failureReason: reason,
            createdAt,
            simulationRunId: runId,
            errorCode: `DEMO_${reason}`,
            errorDescription: "Seeded synthetic payment failure",
          },
        });
        await event(
          "DETECTED",
          "Failed payment detected",
          { reason, amountPaise, simulation: true, runId },
          tx.id,
        );
        let planned = await planTransaction(tx.id, { now: createdAt });
        for (let attemptNo = 1; attemptNo <= 2; attemptNo++) {
          const attempt = planned.attempts.find(
            (a) => a.attemptNo === attemptNo,
          );
          if (!attempt || attempt.channel === "none") break;
          await dispatchAttempt(attempt.id, {
            mock: true,
            now: attempt.scheduledAt,
          });
          const ok =
            draws[(attemptNo - 1) * 2] <
            outcomeProbability(
              reason,
              attempt.channel,
              attempt.timingBucket,
              attemptNo,
            );
          const outcomeAt = new Date(
            attempt.scheduledAt.getTime() +
              (2 + draws[(attemptNo - 1) * 2 + 1] * 45) * 60000,
          );
          const dispatched = await db.recoveryAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
          await settleAttempt(attempt.id, ok, outcomeAt, {
            paymentLinkId: dispatched.paymentLinkId!, synthetic: true,
          });
          if (ok) {
            await db.simulationRun.update({
              where: { id: runId },
              data: { recovered: { increment: 1 } },
            });
            break;
          }
          if (reason !== "CART_ABANDONED" || attemptNo === 2) break;
          planned = await planTransaction(tx.id, {
            attemptNo: 2,
            now: createdAt,
          });
        }
        await db.simulationRun.update({
          where: { id: runId },
          data: { processed: { increment: 1 } },
        });
      });
    }
    await db.simulationRun.update({
      where: { id: runId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await event("SIMULATION_COMPLETED", "Simulation complete", { runId });
  } catch (error) {
    console.error("Simulation failed", error);
    await db.simulationRun.updateMany({
      where: { id: runId },
      data: {
        status: "FAILED",
        error:
          "Simulation interrupted; inspect server and reset before rerunning.",
        completedAt: new Date(),
      },
    });
  }
  return db.simulationRun.findUnique({ where: { id: runId } });
}
