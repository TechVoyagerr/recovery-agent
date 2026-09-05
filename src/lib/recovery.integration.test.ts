import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";

const directory = mkdtempSync(join(tmpdir(), "recovery-test-"));
let db: typeof import("./db").db;
let service: typeof import("./agent/service");
let inbound: typeof import("./inbound").inbound;
let webhook: typeof import("./webhooks").webhook;
let getStats: typeof import("./queries").getStats;
const send = vi.fn(async () => {});

beforeAll(async () => {
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  process.env.AGENT_LLM = "off";
  process.env.RAZORPAY_WEBHOOK_SECRET = "unit-test-webhook-secret";
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], { env: process.env, stdio: "pipe" });
  ({ db } = await import("./db"));
  service = await import("./agent/service");
  ({ inbound } = await import("./inbound"));
  ({ webhook } = await import("./webhooks"));
  ({ getStats } = await import("./queries"));
  (await import("./payments")).setNotifier({ name: "test", send });
}, 30000);
beforeEach(async () => {
  await db.messageEvent.deleteMany(); await db.agentEvent.deleteMany();
  await db.recoveryAttempt.deleteMany(); await db.transaction.deleteMany();
  await db.customer.deleteMany(); await db.merchant.deleteMany();
  await db.learningStat.deleteMany(); await db.webhookReceipt.deleteMany();
  send.mockClear();
  await db.merchant.create({ data: { id: "m", name: "Test" } });
  await db.customer.create({ data: { id: "c", merchantId: "m", name: "Test", phone: "+919000000001", email: "test@example.com", city: "Pune" } });
});
afterAll(async () => { await db?.$disconnect(); rmSync(directory, { recursive: true, force: true }); });
async function failure() {
  const tx = await db.transaction.create({ data: {
    merchantId: "m", customerId: "c", amountPaise: 129900, method: "upi",
    failureReason: "NETWORK_DROP", razorpayPaymentId: "pay_original", razorpayOrderId: "order_original", isDemo: true,
  } });
  return service.planTransaction(tx.id);
}
async function paid(event: string, payload: object) {
  const raw = JSON.stringify({ event, payload });
  return webhook(new Request("http://test/api/webhooks/razorpay", { method: "POST", body: raw,
    headers: { "x-razorpay-signature": createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest("hex") },
  }));
}

describe("inbound opt-out and delivery", () => {
  it.each(["STOP", "unsubscribe", "BaNd"])("cancels pending and refuses future outreach for %s", async (text) => {
    const tx = await failure();
    const response = await inbound(new Request("http://test/api/inbound", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ from: "whatsapp:+919000000001", text }) }));
    expect(await response.json()).toMatchObject({ optedOut: true, cancelled: 1 });
    expect((await db.customer.findUniqueOrThrow({ where: { id: "c" } })).optedOut).toBe(true);
    expect((await db.recoveryAttempt.findUniqueOrThrow({ where: { id: tx.attempts[0].id } })).outcome).toBe("CANCELLED");
    await service.dispatchAttempt(tx.attempts[0].id, { mock: true });
    const next = await db.transaction.create({ data: { merchantId: "m", customerId: "c", amountPaise: 10000, method: "upi", failureReason: "OTP_TIMEOUT" } });
    const planned = await service.planTransaction(next.id);
    expect(planned.attempts[0].channel).toBe("none");
    await service.dispatchAttempt(planned.attempts[0].id, { mock: true });
    expect(send).not.toHaveBeenCalled();
    expect(await db.messageEvent.count()).toBe(0);
    expect(await db.agentEvent.count({ where: { type: "OPT_OUT" } })).toBe(1);
  });
  it("accepts Twilio form fields and ignores non-keyword text", async () => {
    await failure();
    const request = (text: string) => new Request("http://test/api/inbound", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ From: "whatsapp:+919000000001", Body: text }) });
    expect(await (await inbound(request("please don't stop"))).json()).toMatchObject({ ignored: true });
    expect(await (await inbound(request(" stop "))).json()).toMatchObject({ optedOut: true });
  });
  it("rechecks consent at dispatch even if changed after planning", async () => {
    const tx = await failure();
    await db.customer.update({ where: { id: "c" }, data: { optedOut: true } });
    await service.dispatchAttempt(tx.attempts[0].id, { mock: true });
    expect(send).not.toHaveBeenCalled();
  });
});

describe("honest recovery attribution", () => {
  it.each(["payment.captured", "order.paid"])("does not credit original %s after a reminder", async (name) => {
    const tx = await failure();
    await service.dispatchAttempt(tx.attempts[0].id, { mock: true });
    expect((await paid(name, { payment: { entity: { id: "pay_original", order_id: "order_original", amount: 129900 } } })).status).toBe(200);
    expect((await db.transaction.findUniqueOrThrow({ where: { id: tx.id } })).status).toBe("PAID");
    expect((await getStats()).recovered).toBe(0);
    expect(await db.learningStat.count()).toBe(0);
  });
  it("credits a matching paid link once and records its attribution", async () => {
    const tx = await failure(); const id = tx.attempts[0].id;
    await service.dispatchAttempt(id, { mock: true });
    const a = await db.recoveryAttempt.findUniqueOrThrow({ where: { id } });
    const payload = { payment_link: { entity: { id: a.paymentLinkId, amount_paid: 129900 } }, payment: { entity: { id: "pay_recovery", amount: 129900 } } };
    expect((await paid("payment_link.paid", payload)).status).toBe(200);
    expect(await (await paid("payment_link.paid", payload)).json()).toMatchObject({ duplicate: true });
    expect(await db.recoveryAttempt.findUniqueOrThrow({ where: { id } })).toMatchObject({ outcome: "RECOVERED", attribution: "PAYMENT_LINK", recoveredPaymentId: "pay_recovery" });
    expect(await getStats()).toMatchObject({ recovered: 1, revenueRecoveredPaise: 129900, synthetic: true });
    expect((await db.learningStat.findFirstOrThrow()).successes).toBe(1);
  });
  it("rejects absent or unrelated recovery proof", async () => {
    const tx = await failure(); const id = tx.attempts[0].id;
    await service.dispatchAttempt(id, { mock: true });
    expect(await service.settleAttempt(id, true)).toBe(false);
    expect(await service.settleAttempt(id, true, new Date(), { paymentLinkId: "unrelated" })).toBe(false);
    expect((await getStats()).recovered).toBe(0);
  });
  it("rejects mismatched paid amount", async () => {
    const tx = await failure(); await service.dispatchAttempt(tx.attempts[0].id, { mock: true });
    const a = await db.recoveryAttempt.findUniqueOrThrow({ where: { id: tx.attempts[0].id } });
    expect((await paid("payment_link.paid", { payment_link: { entity: { id: a.paymentLinkId, amount_paid: 1 } } })).status).toBe(409);
    expect((await getStats()).recovered).toBe(0);
  });
  it("does not credit transaction notes without a matching recovery link", async () => {
    const tx = await failure(); await service.dispatchAttempt(tx.attempts[0].id, { mock: true });
    await paid("payment.captured", { payment: { entity: { id: "pay_other", amount: 129900, notes: { transactionId: tx.id } } } });
    expect((await getStats()).recovered).toBe(0);
  });
  it("excludes legacy recovered rows without attribution from every recovery metric", async () => {
    const tx = await failure(); const id = tx.attempts[0].id;
    await service.dispatchAttempt(id, { mock: true });
    await db.recoveryAttempt.update({ where: { id }, data: { outcome: "RECOVERED", attribution: null } });
    await db.transaction.update({ where: { id: tx.id }, data: { status: "RECOVERED", recoveredAt: new Date() } });
    const stats = await getStats();
    expect(stats.recovered).toBe(0); expect(stats.revenueRecoveredPaise).toBe(0);
    expect(stats.byChannel.every((r) => r.recovered === 0)).toBe(true);
    expect(stats.byReason.every((r) => r.recovered === 0)).toBe(true);
    expect(stats.timeline.every((r) => r.recovered === 0)).toBe(true);
  });
  it("corrects a failed attempt's learning once when its link is paid late", async () => {
    const tx = await failure(); const id = tx.attempts[0].id;
    await service.dispatchAttempt(id, { mock: true });
    await service.settleAttempt(id, false);
    const a = await db.recoveryAttempt.findUniqueOrThrow({ where: { id } });
    await paid("payment_link.paid", { payment_link: { entity: { id: a.paymentLinkId, amount_paid: 129900 } } });
    expect(await db.learningStat.findFirstOrThrow()).toMatchObject({ successes: 1, failures: 0 });
  });
  it("allows payment of an already sent link after STOP without sending again", async () => {
    const tx = await failure(); const id = tx.attempts[0].id;
    await service.dispatchAttempt(id, { mock: true });
    await inbound(new Request("http://test/api/inbound", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ from: "+919000000001", text: "STOP" }) }));
    const a = await db.recoveryAttempt.findUniqueOrThrow({ where: { id } });
    await paid("payment_link.paid", { payment_link: { entity: { id: a.paymentLinkId, amount_paid: 129900 } } });
    expect((await getStats()).recovered).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await db.customer.findUniqueOrThrow({ where: { id: "c" } })).optedOut).toBe(true);
  });
  it("does not label real-only data as synthetic", async () => {
    const tx = await failure();
    await db.transaction.update({ where: { id: tx.id }, data: { isDemo: false } });
    expect((await getStats()).synthetic).toBe(false);
  });

});


it("recovers orphaned and timed-out simulations while preserving an active worker", async () => {
  const { createRun, recoverStaleRuns } = await import("./simulator");
  const orphan = await db.simulationRun.create({ data: { n: 1, seed: 7 } });
  const active = await createRun(1, 7);
  expect((await service.exclusive(recoverStaleRuns))?.id).toBe(active.id);
  expect((await db.simulationRun.findUniqueOrThrow({ where: { id: orphan.id } })).status).toBe("FAILED");
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 180001);
  try {
    expect(await service.exclusive(recoverStaleRuns)).toBeNull();
    expect((await db.simulationRun.findUniqueOrThrow({ where: { id: active.id } })).status).toBe("FAILED");
  } finally {
    clock.mockRestore();
  }
});

describe("contiguous demo timeline", () => {
  function assertTimeline(stats: Awaited<ReturnType<typeof getStats>>) {
    expect(stats.timeline).toHaveLength(24);
    const times = stats.timeline.map((b) => Date.parse(b.bucket));
    expect(new Set(times).size).toBe(24);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBe(3600000);
  }
  it("seeds an empty base before live and keeps 24 contiguous buckets after reset + live", async () => {
    const { reset } = await import("./seed");
    const { createRun, executeRun, seedDemoBaseline } = await import("./simulator");
    await service.exclusive(async () => {
      await reset();
      await seedDemoBaseline();
    });
    const baseline = await getStats();
    expect(baseline.totalFailed).toBe(1000);
    expect(baseline.recovered).toBeGreaterThan(300);
    assertTimeline(baseline);
    const live = await service.exclusive(() => createRun(1, 42, "live"));
    expect((await executeRun(live.id, "live"))?.status).toBe("COMPLETED");
    const stats = await getStats();
    expect(stats.totalFailed).toBe(1001);
    assertTimeline(stats);
    const latest = await db.transaction.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    expect(Date.parse(stats.timeline[23].bucket)).toBe(Math.floor(latest.createdAt.getTime() / 3600000) * 3600000);
    await service.exclusive(async () => {
      await reset();
      const run = await createRun(1, 42, "live");
      expect(await db.transaction.count()).toBe(1000);
      expect((await executeRun(run.id, "live", true))?.status).toBe("COMPLETED");
    });
    assertTimeline(await getStats());
  }, 120000);
  it("zero fills an empty dataset and gaps without extending to future recoveries", async () => {
    assertTimeline(await getStats());
    await failure();
    const stats = await getStats();
    assertTimeline(stats);
    expect(stats.timeline.filter((b) => b.failed === 0)).toHaveLength(23);
  });
});
