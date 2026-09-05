import {
  Channel,
  Customer,
  FailureReason,
  LearningStat,
  PaymentMethod,
  RecoveryDecision,
  TimingBucket,
} from "../types";
import { formatINR } from "../format";
export const BASE_RATES: Record<FailureReason, number> = {
  INSUFFICIENT_FUNDS: 0.3,
  BANK_DOWN: 0.7,
  OTP_TIMEOUT: 0.58,
  UPI_APP_ERROR: 0.49,
  CARD_EXPIRED: 0.34,
  CARD_DECLINED: 0.12,
  NETWORK_DROP: 0.56,
  CART_ABANDONED: 0.33,
  LIMIT_EXCEEDED: 0.22,
  USER_CANCELLED: 0.04,
  UNKNOWN: 0.2,
};
const policies: Record<FailureReason, [string, TimingBucket, string, string]> =
  {
    INSUFFICIENT_FUNDS: [
      "SALARY_DAY_RETRY",
      "salary",
      "The issuer reported insufficient funds, so repeating the request now is unlikely to help. A gentle reminder during the next 1st–3rd salary window gives the customer time to replenish their balance.",
      "complete your order when convenient, using another account if you prefer",
    ],
    BANK_DOWN: [
      "BANK_COOLDOWN_ALTERNATE",
      "15m",
      "This looks like a temporary bank outage rather than a loss of purchase intent. Allow 15 minutes for the bank to recover, then offer another bank or payment method.",
      "try another bank or payment method after the short bank interruption",
    ],
    OTP_TIMEOUT: [
      "UPI_INTENT_LINK",
      "immediate",
      "The customer reached authentication but the OTP session expired. An immediate Payment Link offering UPI removes the repeated card OTP step while purchase intent is still fresh.",
      "finish securely with UPI or another available method",
    ],
    UPI_APP_ERROR: [
      "ALTERNATE_UPI_APP",
      "15m",
      "The UPI app failed before completion. A short pause and a fresh link let the customer select another UPI app or bank without rebuilding the order.",
      "try a different UPI app or payment method",
    ],
    CARD_EXPIRED: [
      "UPDATE_PAYMENT_METHOD",
      "immediate",
      "An expired card cannot succeed on a blind retry. Ask the customer to choose a new card or UPI through a secure hosted checkout; never request card details in a message.",
      "choose a new card or UPI to complete your order",
    ],
    CARD_DECLINED: [
      "ONE_ALTERNATE_METHOD",
      "30m",
      "The issuer declined the card and another identical charge is unlikely to work. Send one low-pressure alternative-method reminder, then stop if it does not convert.",
      "use another payment method if you still wish to complete the order",
    ],
    NETWORK_DROP: [
      "RESUME_CHECKOUT",
      "immediate",
      "A connection interruption does not necessarily mean the customer changed their mind. Restore checkout immediately with a fresh link and reassure them that payment confirmation will stop further reminders.",
      "resume your interrupted checkout securely",
    ],
    CART_ABANDONED: [
      "CART_REMINDER",
      "30m",
      "The checkout was left unfinished with no confirmed bank failure. Wait 30 minutes to avoid interrupting browsing, then send one reminder; a final follow-up is eligible after 24 hours.",
      "return to your saved order whenever convenient",
    ],
    LIMIT_EXCEEDED: [
      "ALTERNATE_OR_EMI",
      "24h",
      "The payment exceeded an account or card limit. Wait until the next day and suggest another account or eligible EMI; split payment requires merchant support and is not promised by this link.",
      "try another account, or ask the store about eligible EMI or split-payment options",
    ],
    USER_CANCELLED: [
      "DO_NOTHING",
      "none",
      "The customer explicitly cancelled. Respect that choice: the estimated chance of recovery is too low to justify an unsolicited reminder.",
      "",
    ],
    UNKNOWN: [
      "GENTLE_CHECKOUT_LINK",
      "30m",
      "The gateway details do not identify a reliable cause. Avoid claiming a bank or customer fault; offer one neutral checkout reminder and learn from its outcome.",
      "complete your order securely if you would still like it",
    ],
  };
export function decide(input: {
  reason: FailureReason;
  method: PaymentMethod;
  amountPaise: number;
  customer: Pick<
    Customer,
    "name" | "language" | "segment" | "optedOut" | "phone" | "email"
  >;
  now?: Date;
  attemptNo?: number;
  learning?: LearningStat[];
}): RecoveryDecision {
  const { reason, customer } = input;
  const now = input.now ?? new Date();
  const attemptNo = input.attemptNo ?? 1;
  let [strategy, timingBucket, reasoning] = policies[reason];
  const action = policies[reason][3];
  if (customer.optedOut || attemptNo > (reason === "CART_ABANDONED" ? 2 : 1)) {
    strategy = "DO_NOTHING";
    timingBucket = "none";
    reasoning = customer.optedOut
      ? "The customer has opted out of recovery communication. Consent takes priority over predicted revenue, so no link or message will be sent."
      : "The permitted reminder sequence is exhausted. Stop outreach to protect customer trust.";
  }
  if (
    reason === "CART_ABANDONED" &&
    attemptNo === 2 &&
    strategy !== "DO_NOTHING"
  ) {
    timingBucket = "24h";
    strategy = "FINAL_CART_REMINDER";
    reasoning =
      "The first cart reminder did not convert. Send a single final reminder 24 hours after checkout, then stop regardless of order value.";
  }
  const scheduled = new Date(now);
  if (timingBucket === "salary") {
    const india = new Date(now.getTime() + 330 * 60000);
    const day = india.getUTCDate();
    const nextMonth = day > 3 || (day === 3 && india.getUTCHours() >= 20);
    const month = india.getUTCMonth() + (nextMonth ? 1 : 0);
    scheduled.setTime(
      Date.UTC(india.getUTCFullYear(), month, nextMonth ? 1 : day, 4, 30),
    );
    if (scheduled < now) scheduled.setTime(now.getTime() + 60 * 60000);
  } else
    scheduled.setTime(
      now.getTime() +
        ({ immediate: 0, "15m": 15, "30m": 30, "24h": 1440, none: 0 }[
          timingBucket
        ] ?? 0) *
          60000,
    );
  const channels: Channel[] = customer.phone
    ? ["whatsapp", "sms", ...(customer.email ? ["email" as Channel] : [])]
    : customer.email
      ? ["email"]
      : [];
  const prior = (ch: Channel) =>
    BASE_RATES[reason] * (ch === "whatsapp" ? 1 : ch === "sms" ? 0.84 : 0.66);
  const posterior = (ch: Channel) => {
    const s = input.learning?.find(
      (s) =>
        s.reason === reason &&
        s.channel === ch &&
        s.timingBucket === timingBucket,
    );
    return (
      (prior(ch) * 12 + (s?.successes ?? 0)) /
      (12 + (s?.successes ?? 0) + (s?.failures ?? 0))
    );
  };
  let channel: Channel =
    channels.sort((a, b) => posterior(b) - posterior(a))[0] ?? "none";
  if (channel === "none" && strategy !== "DO_NOTHING")
    reasoning +=
      " No reachable contact method is on file, so outreach is suppressed.";
  if (strategy === "DO_NOTHING" || channel === "none") {
    channel = "none";
    strategy = "DO_NOTHING";
    timingBucket = "none";
  }
  let probability = channel === "none" ? 0 : posterior(channel);
  if (channel !== "none" && probability < 0.03) {
    reasoning += ` Observed outcomes have reduced estimated recovery below the 3% outreach threshold. Suppress further reminders.`;
    channel = "none";
    strategy = "DO_NOTHING";
    timingBucket = "none";
    probability = 0;
  }
  if (channel !== "none")
    reasoning += ` For this ${formatINR(input.amountPaise)} ${input.method.toUpperCase()} order, ${channel} ranks highest among reachable channels at ${Math.round(probability * 100)}% estimated recovery, using a reason-specific prior and observed outcomes. This is a customer-authorised checkout invitation, not an automatic debit.`;
  const name = customer.name.split(" ")[0];
  const hindiAction: Record<FailureReason, string> = {
    INSUFFICIENT_FUNDS:
      "Salary ke aas-paas, suvidha hone par payment karein; doosra account bhi chun sakte hain",
    BANK_DOWN:
      "Bank mein dikkat thi; 15 minute baad doosra bank ya payment method try karein",
    OTP_TIMEOUT:
      "OTP session khatam ho gaya tha; UPI se aasani se dobara try karein",
    UPI_APP_ERROR: "UPI app mein dikkat thi; doosra UPI app ya bank try karein",
    CARD_EXPIRED: "Purana card expire ho gaya hai; naya card ya UPI chunein",
    CARD_DECLINED:
      "Agar order abhi bhi chahiye, doosra payment method try kar sakte hain",
    NETWORK_DROP:
      "Connection toot gaya tha; apna checkout yahan se poora karein",
    CART_ABANDONED:
      "Aapka order save hai; suvidha se checkout poora kar sakte hain",
    LIMIT_EXCEEDED:
      "Kal doosra account try karein, ya store se eligible EMI aur split payment ke baare mein poochhein",
    USER_CANCELLED: "",
    UNKNOWN:
      "Agar order abhi bhi chahiye, secure checkout dobara khol sakte hain",
  };
  const message =
    channel === "none"
      ? ""
      : customer.language === "hi"
        ? `Namaste ${name}, Chai Point ka ${formatINR(input.amountPaise)} ka order abhi complete nahi hua. ${hindiAction[reason]}. Secure link: {{link}}. Madad chahiye toh store se sampark karein. Reminders band karne ke liye STOP reply karein.`
        : `Hi ${name}, your ${formatINR(input.amountPaise)} Chai Point order is still unpaid. Please ${action}: {{link}}. If already paid, please ignore this reminder. Reply STOP to opt out.`;
  return {
    strategy,
    channel,
    timingBucket,
    scheduledAt: scheduled.toISOString(),
    message,
    reasoning,
    confidence: reason === "UNKNOWN" ? 0.55 : 0.88,
    expectedRecoveryProbability: probability,
  };
}
