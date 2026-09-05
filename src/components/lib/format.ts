import type { Channel, FailureReason, PaymentMethod, TransactionStatus } from "@/lib/types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** ₹1,24,850 - Indian grouping, no decimals. */
export function money(paise: number): string {
  return inr.format(Math.round((paise ?? 0) / 100));
}

/** Short form for hero stats and axis labels: ₹8.4L, ₹1.2Cr. */
export function moneyShort(paise: number): string {
  const rupees = (paise ?? 0) / 100;
  if (Math.abs(rupees) >= 1e7) return `₹${trim(rupees / 1e7)}Cr`;
  if (Math.abs(rupees) >= 1e5) return `₹${trim(rupees / 1e5)}L`;
  if (Math.abs(rupees) >= 1e3) return `₹${trim(rupees / 1e3)}K`;
  return `₹${Math.round(rupees)}`;
}

function trim(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

export function num(n: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(n ?? 0));
}

export function pct(rate: number, digits = 1): string {
  const value = rate > 1 ? rate : rate * 100;
  return `${value.toFixed(digits)}%`;
}

/** Accepts a 0-1 or 0-100 rate and returns 0-100. */
export function toPercent(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  return rate > 1 ? rate : rate * 100;
}

export function minutes(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return "-";
  if (m < 1) return `${Math.round(m * 60)}s`;
  if (m < 60) return `${m.toFixed(m < 10 ? 1 : 0)} min`;
  const h = Math.floor(m / 60);
  const rest = Math.round(m % 60);
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

export function timeOfDay(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/** Historical timestamps use elapsed time throughout the dashboard. */
export function dateTime(iso: string | null | undefined): string {
  return relative(iso);
}

export function relative(iso: string | null | undefined): string {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "-";
  const seconds = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  const days = Math.floor(seconds / 86400);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export const REASON_LABELS: Record<string, string> = {
  INSUFFICIENT_FUNDS: "Insufficient funds",
  BANK_DOWN: "Bank downtime",
  OTP_TIMEOUT: "OTP timed out",
  UPI_APP_ERROR: "UPI app error",
  CARD_EXPIRED: "Card expired",
  CARD_DECLINED: "Card declined",
  NETWORK_DROP: "Network dropped",
  CART_ABANDONED: "Cart abandoned",
  LIMIT_EXCEEDED: "Limit exceeded",
  USER_CANCELLED: "Customer cancelled",
  UNKNOWN: "Unknown",
};

export function reasonLabel(reason: string | null | undefined): string {
  if (!reason) return "Unknown";
  return REASON_LABELS[reason] ?? reason.toLowerCase().replace(/_/g, " ");
}

export const METHOD_LABELS: Record<string, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Netbanking",
  wallet: "Wallet",
};

export function methodLabel(method: string | null | undefined): string {
  if (!method) return "-";
  return METHOD_LABELS[method] ?? method;
}

export const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Email",
  none: "No nudge",
};

export function channelLabel(channel: string | null | undefined): string {
  if (!channel) return "-";
  return CHANNEL_LABELS[channel] ?? channel;
}

export const STATUS_LABELS: Record<string, string> = {
  FAILED: "Failed",
  RECOVERED: "Recovered",
  PENDING_RECOVERY: "In recovery",
  GIVEN_UP: "Given up",
  PAID: "Paid",
};

export function statusLabel(status: string | null | undefined): string {
  if (!status) return "-";
  return STATUS_LABELS[status] ?? status;
}

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export function statusTone(status: TransactionStatus | string): Tone {
  switch (status) {
    case "RECOVERED":
    case "PAID":
      return "success";
    case "PENDING_RECOVERY":
      return "warning";
    case "GIVEN_UP":
      return "neutral";
    default:
      return "danger";
  }
}

export function outcomeTone(outcome: string): Tone {
  switch (outcome) {
    case "RECOVERED":
      return "success";
    case "PENDING":
      return "warning";
    case "EXPIRED":
      return "neutral";
    default:
      return "danger";
  }
}

export const CHANNEL_TONE: Record<string, Tone> = {
  whatsapp: "success",
  sms: "info",
  email: "neutral",
  none: "neutral",
};

export const REASON_OPTIONS: FailureReason[] = [
  "INSUFFICIENT_FUNDS",
  "BANK_DOWN",
  "OTP_TIMEOUT",
  "UPI_APP_ERROR",
  "CARD_EXPIRED",
  "CARD_DECLINED",
  "NETWORK_DROP",
  "CART_ABANDONED",
  "LIMIT_EXCEEDED",
  "USER_CANCELLED",
  "UNKNOWN",
];

export const METHOD_OPTIONS: PaymentMethod[] = ["upi", "card", "netbanking", "wallet"];
export const CHANNEL_OPTIONS: Channel[] = ["whatsapp", "sms", "email", "none"];
export const STATUS_OPTIONS: TransactionStatus[] = [
  "FAILED",
  "PENDING_RECOVERY",
  "RECOVERED",
  "PAID",
  "GIVEN_UP",
];

export const SERIES = ["#2B84EA", "#2F9E68", "#C88A2C", "#CF5A52"];
