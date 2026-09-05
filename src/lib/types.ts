export const REASONS = [
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
] as const;
export type FailureReason = (typeof REASONS)[number];
export type Channel = "whatsapp" | "sms" | "email" | "none";
export type PaymentMethod = "upi" | "card" | "netbanking" | "wallet";
export type TransactionStatus =
  "FAILED" | "RECOVERED" | "PENDING_RECOVERY" | "GIVEN_UP" | "PAID";
export type TimingBucket =
  "immediate" | "15m" | "30m" | "24h" | "salary" | "none";
export interface RecoveryDecision {
  strategy: string;
  channel: Channel;
  scheduledAt: string;
  timingBucket: TimingBucket;
  message: string;
  reasoning: string;
  confidence: number;
  expectedRecoveryProbability: number;
}
export interface Customer {
  id: string;
  merchantId: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  language: string;
  segment: string;
  optedOut: boolean;
}
export interface RecoveryAttempt extends RecoveryDecision {
  id: string;
  transactionId: string;
  sentAt: string | null;
  paymentLinkId: string | null;
  paymentLinkUrl: string | null;
  attribution?: "PAYMENT_LINK" | "SIMULATED_LINK" | null;
  recoveredPaymentId?: string | null;
  outcome: "PENDING" | "RECOVERED" | "FAILED" | "EXPIRED" | "CANCELLED";
  recoveredAt: string | null;
  attemptNo: number;
}
export interface AgentEvent {
  id: string;
  type: string;
  title: string;
  detail: Record<string, unknown>;
  transactionId: string | null;
  createdAt: string;
}
export interface Transaction {
  id: string;
  merchantId: string;
  customerId: string;
  amountPaise: number;
  currency: string;
  method: PaymentMethod;
  status: TransactionStatus;
  failureReason: FailureReason | "NONE";
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  createdAt: string;
  recoveredAt: string | null;
  customer: Customer;
  attempts: RecoveryAttempt[];
}
export interface LearningStat {
  id: string;
  reason: string;
  channel: string;
  timingBucket: string;
  successes: number;
  failures: number;
}
export interface Stats {
  synthetic: boolean;
  totalSuppressed: number;
  totalFailed: number;
  totalAttempted: number;
  recovered: number;
  recoveryRate: number;
  revenueAtRiskPaise: number;
  revenueRecoveredPaise: number;
  avgRecoveryMinutes: number;
  activeRecoveries: number;
  byReason: {
    reason: string;
    failed: number;
    attempted: number;
    suppressed: number;
    recovered: number;
    revenueRecoveredPaise: number;
    rate: number;
  }[];
  byChannel: {
    channel: string;
    attempts: number;
    recovered: number;
    rate: number;
  }[];
  timeline: {
    bucket: string;
    failed: number;
    recovered: number;
    revenueRecoveredPaise: number;
  }[];
}
export interface SimulationProgress {
  id: string;
  seed: number;
  n: number;
  processed: number;
  recovered: number;
  status: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}
export interface TransactionsResponse {
  items: Transaction[];
  nextCursor: string | null;
}
export interface LearningResponse {
  stats: LearningStat[];
  matrix: { reason: string; channel: string; rate: number; n: number }[];
  insights: string[];
}
