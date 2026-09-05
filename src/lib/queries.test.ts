import { beforeEach, expect, it, vi } from "vitest";
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("./db", () => ({ db: { transaction: { findMany } } }));
import { getStats } from "./queries";
beforeEach(() => findMany.mockReset());
it("returns exactly 24 contiguous zero-filled hours for a sparse reset + live timeline", async () => {
  const tx = (date: string) => ({ createdAt: new Date(date), failureReason: "NETWORK_DROP", status: "FAILED", attempts: [], amountPaise: 10000 });
  findMany.mockResolvedValue([
    tx("2026-07-27T00:00:00Z"), // Old baseline data must not introduce a gap.
    tx("2026-08-02T11:21:00Z"),
    tx("2026-08-02T23:59:00Z"),
    tx("2026-08-02T23:01:00Z"),
    { ...tx("2026-08-02T14:00:00Z"), status: "RECOVERED", recoveredAt: new Date("2026-08-05T15:00:00Z"), attempts: [{ outcome: "RECOVERED", sentAt: new Date(), paymentLinkId: "test", attribution: "SIMULATED_LINK" }] },
  ]);
  const { timeline } = await getStats();
  expect(timeline.map((b) => b.bucket)).toEqual(Array.from({ length: 24 }, (_, i) => new Date(Date.UTC(2026, 7, 2, i)).toISOString()));
  expect(timeline[0].failed).toBe(0);
  expect(timeline[23].failed).toBe(2);
  expect(timeline.reduce((n, b) => n + b.recovered, 0)).toBe(0);
});
