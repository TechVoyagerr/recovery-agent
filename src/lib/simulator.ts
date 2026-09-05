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
// Share ownership across route bundles and hot reloads; a new process starts empty.
const runGlobal = globalThis as typeof globalThis & { simulationHeartbeats?: Map<string, number> };
const activeRuns = runGlobal.simulationHeartbeats ??= new Map<string, number>();
const STALE_AFTER_MS = 3 * 60 * 1000;

// Call under exclusive(), just like creation/reset, to avoid admission races.
export async function recoverStaleRuns() {
  const running = await db.simulationRun.findMany({ where: { status: "RUNNING" } });
  for (const run of running) {
    const heartbeat = activeRuns.get(run.id);
    if (heartbeat === undefined || Date.now() - heartbeat > STALE_AFTER_MS) {
      await db.simulationRun.updateMany({
        where: { id: run.id, status: "RUNNING" },
        data: { status: "FAILED", completedAt: new Date(), error: "Simulation interrupted: its worker stopped or made no progress for 3 minutes." },
      });
      activeRuns.delete(run.id);
    }
  }
  return db.simulationRun.findFirst({ where: { status: "RUNNING" } });
}

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
  // Bootstrap reference data only; simulation must never reset existing payments.
  await seedData();
  const run = await db.simulationRun.create({ data: { n, seed } });
  activeRuns.set(run.id, Date.now());
  return run;
}
export async function executeRun(
  runId: string,
  speed: "instant" | "live" = "instant",
) {
  try {
    const run = await db.simulationRun.findUniqueOrThrow({
      where: { id: runId },
    });
    const rng = seededRandom(run.seed);
    const customers = await db.customer.findMany({ orderBy: { id: "asc" } });
    const start = Date.now();
    // Fixed virtual epoch keeps salary-window outcomes reproducible across calendar dates.
    const base = new Date("2026-07-27T00:00:00.000Z");
    await event("SIMULATION_STARTED", "Recovery simulation started", {
      runId,
      n: run.n,
      seed: run.seed,
      speed,
    });
    const pending: Promise<void>[] = [];
    for (let i = 0; i < run.n; i++) {
      if (speed === "live") {
        const delay = start + (i / run.n) * 45000 - Date.now();
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      }
      const finish = await exclusive(async () => {
        if (!activeRuns.has(runId)) throw new Error("Simulation worker is no longer active");
        const reason = REASONS[Math.floor(rng() * REASONS.length)];
        const customer = customers[Math.floor(rng() * customers.length)];
        const method = reason.startsWith("CARD")
          ? "card"
          : reason === "UPI_APP_ERROR"
            ? "upi"
            : ["upi", "card", "netbanking", "wallet"][Math.floor(rng() * 4)];
        const amountPaise = (99 + Math.floor(rng() * 4901)) * 100;
        const virtualCreatedAt = new Date(
          base.getTime() + Math.floor(rng() * 7 * 86400000),
        );
        // Reuse the existing random draw to preserve seeded outcome sequences.
        const createdAt = speed === "live"
          ? new Date(start - ((virtualCreatedAt.getTime() - base.getTime()) / (7 * 86400000)) * 30 * 60000)
          : virtualCreatedAt;
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
        return async () => {
          for (let attemptNo = 1; attemptNo <= 2; attemptNo++) {
            const attempt = planned.attempts.find(
              (a) => a.attemptNo === attemptNo,
            );
            if (!attempt || attempt.channel === "none") break;
            await exclusive(async () => {
              if (speed === "live") {
                attempt.scheduledAt = new Date();
                await db.recoveryAttempt.update({ where: { id: attempt.id }, data: { scheduledAt: attempt.scheduledAt } });
              }
              await dispatchAttempt(attempt.id, { mock: true, now: attempt.scheduledAt });
            });
            const ok =
              draws[(attemptNo - 1) * 2] <
              outcomeProbability(
                reason,
                attempt.channel,
                attempt.timingBucket,
                attemptNo,
              );
            if (speed === "live") await new Promise((resolve) => setTimeout(resolve, 1000 + draws[(attemptNo - 1) * 2 + 1] * 2000));
            const outcomeAt = speed === "live" ? new Date() : new Date(
              attempt.scheduledAt.getTime() +
                (2 + draws[(attemptNo - 1) * 2 + 1] * 45) * 60000,
            );
            const dispatched = await db.recoveryAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
            await exclusive(() => settleAttempt(attempt.id, ok, outcomeAt, {
              paymentLinkId: dispatched.paymentLinkId!, synthetic: true,
            }));
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
          activeRuns.set(runId, Date.now());
        };
      });
      if (speed === "live") {
        // Settlements overlap arrivals without holding the global mutation lock.
        const job = finish();
        void job.catch(() => {});
        pending.push(job);
      } else {
        await finish();
      }
    }
    await Promise.all(pending);
    await db.simulationRun.update({
      where: { id: runId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await event("SIMULATION_COMPLETED", "Simulation complete", { runId });
  } catch (error) {
    console.error("Simulation failed", error);
    await db.simulationRun.updateMany({
      where: { id: runId, status: "RUNNING" },
      data: {
        status: "FAILED",
        error:
          "Simulation interrupted; inspect server and reset before rerunning.",
        completedAt: new Date(),
      },
    });
  } finally {
    activeRuns.delete(runId);
  }
  return db.simulationRun.findUnique({ where: { id: runId } });
}
