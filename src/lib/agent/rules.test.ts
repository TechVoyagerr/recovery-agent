import { describe, it, expect } from "vitest";
import { classifyFailure } from "./classifier";
import { decide } from "./rules";
import { REASONS } from "../types";
const customer = {
  name: "Priya Sharma",
  language: "en",
  segment: "loyal",
  optedOut: false,
  phone: "+919000000001",
  email: "priya@example.com",
};
const input = {
  reason: "BANK_DOWN" as const,
  method: "upi" as const,
  amountPaise: 129900,
  customer,
  now: new Date("2026-09-05T06:00:00Z"),
};
describe("failure classifier", () => {
  it.each([
    [{ error_reason: "insufficient_funds" }, "INSUFFICIENT_FUNDS"],
    [
      {
        error_code: "BAD_REQUEST_ERROR",
        error_description: "Your card has expired",
      },
      "CARD_EXPIRED",
    ],
    [{ error_reason: "bank_technical_error" }, "BANK_DOWN"],
    [{ error_reason: "bank_not_available" }, "BANK_DOWN"],
    [{ error_reason: "gateway_technical_error" }, "BANK_DOWN"],
    [
      { error_reason: "payment_declined_due_to_high_traffic", method: "card" },
      "BANK_DOWN",
    ],
    [
      { error_reason: "authorisation_declined_by_psp", method: "upi" },
      "UPI_APP_ERROR",
    ],
    [
      { error_reason: "payment_collect_request_expired", method: "upi" },
      "UPI_APP_ERROR",
    ],
    [{ error_reason: "payment_session_expired" }, "CART_ABANDONED"],
    [{ error_description: "OTP validation timed out" }, "OTP_TIMEOUT"],
    [{ method: "upi", error_description: "intent failed" }, "UPI_APP_ERROR"],
    [{ error_description: "Do not honour" }, "CARD_DECLINED"],
    [{ error_reason: "network_error" }, "NETWORK_DROP"],
    [{ abandoned: true }, "CART_ABANDONED"],
    [{ error_reason: "daily_limit_exceeded" }, "LIMIT_EXCEEDED"],
    [{ error_reason: "customer_cancelled" }, "USER_CANCELLED"],
    [{ error_code: "BAD_REQUEST_ERROR" }, "UNKNOWN"],
    [{ error_source: "bank", error_description: "timeout" }, "BANK_DOWN"],
    [
      { error_step: "payment_authentication", error_description: "timed out" },
      "OTP_TIMEOUT",
    ],
  ] as const)("classifies %j", (value, reason) =>
    expect(classifyFailure(value)).toBe(reason),
  );
});
describe("recovery rules", () => {
  it("allows bank cooldown", () => {
    const d = decide(input);
    expect(d.scheduledAt).toBe("2026-09-05T06:15:00.000Z");
    expect(d.reasoning).toContain("temporary bank outage");
  });
  it("suppresses outreach below the minimum probability", () => {
    const learning = ["whatsapp", "sms", "email"].map((channel) => ({
      id: channel,
      reason: "BANK_DOWN",
      channel,
      timingBucket: "15m",
      successes: 0,
      failures: 500,
    }));
    expect(decide({ ...input, learning }).strategy).toBe("DO_NOTHING");
  });
  it("moves late day-three salary reminders to next month", () =>
    expect(
      decide({
        ...input,
        reason: "INSUFFICIENT_FUNDS",
        now: new Date("2026-09-03T18:29:00Z"),
      }).scheduledAt,
    ).toBe("2026-10-01T04:30:00.000Z"));
  it("uses next salary window in Indian timezone", () =>
    expect(decide({ ...input, reason: "INSUFFICIENT_FUNDS" }).scheduledAt).toBe(
      "2026-10-01T04:30:00.000Z",
    ));
  it("does not schedule in the past on salary days", () =>
    expect(
      new Date(
        decide({
          ...input,
          reason: "INSUFFICIENT_FUNDS",
          now: new Date("2026-09-02T15:00:00Z"),
        }).scheduledAt,
      ).getTime(),
    ).toBeGreaterThan(new Date("2026-09-02T15:00:00Z").getTime()));
  it("never contacts an opted-out customer", () => {
    const d = decide({ ...input, customer: { ...customer, optedOut: true } });
    expect(d.channel).toBe("none");
    expect(d.message).toBe("");
    expect(d.strategy).toBe("DO_NOTHING");
  });
  it("respects cancellation and attempt caps", () => {
    expect(decide({ ...input, reason: "USER_CANCELLED" }).channel).toBe("none");
    expect(decide({ ...input, attemptNo: 2 }).channel).toBe("none");
    expect(
      decide({ ...input, reason: "CART_ABANDONED", attemptNo: 2 }).timingBucket,
    ).toBe("24h");
    expect(
      decide({ ...input, reason: "CART_ABANDONED", attemptNo: 3 }).channel,
    ).toBe("none");
  });
  it("learns enough evidence to change channel", () => {
    const d = decide({
      ...input,
      learning: [
        {
          id: "1",
          reason: "BANK_DOWN",
          channel: "sms",
          timingBucket: "15m",
          successes: 90,
          failures: 10,
        },
      ],
    });
    expect(d.channel).toBe("sms");
  });
  it("does not select unreachable channels", () =>
    expect(
      decide({ ...input, customer: { ...customer, phone: "" } }).channel,
    ).toBe("email"));
  it("suppresses if no contact method exists", () =>
    expect(
      decide({ ...input, customer: { ...customer, phone: "", email: "" } })
        .channel,
    ).toBe("none"));
  it("personalises Hinglish and reason-specific guidance", () => {
    const d = decide({
      ...input,
      reason: "CARD_EXPIRED",
      customer: { ...customer, language: "hi" },
    });
    expect(d.message).toContain("Namaste Priya");
    expect(d.message).toContain("naya card ya UPI");
    expect(d.message).toContain("STOP");
  });
  it.each(REASONS)("returns bounded probabilities for %s", (reason) => {
    const d = decide({ ...input, reason });
    expect(d.expectedRecoveryProbability).toBeGreaterThanOrEqual(0);
    expect(d.expectedRecoveryProbability).toBeLessThanOrEqual(1);
    expect(d.reasoning.length).toBeGreaterThan(50);
    expect(d.confidence).toBeLessThanOrEqual(1);
  });
});
