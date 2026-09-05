import { FailureReason, REASONS } from "../types";
export function classifyFailure(input: {
  error_code?: string | null;
  error_reason?: string | null;
  error_source?: string | null;
  error_step?: string | null;
  error_description?: string | null;
  method?: string;
  abandoned?: boolean;
}): FailureReason {
  if (input.abandoned) return "CART_ABANDONED";
  const text = [input.error_code, input.error_reason, input.error_description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[_-]/g, " ");
  for (const reason of REASONS)
    if (text.includes(reason.toLowerCase().replaceAll("_", " "))) return reason;
  // Prefer specific gateway reasons over broad code/description heuristics.
  const exact = (input.error_reason ?? "").toLowerCase();
  const map: Record<string, FailureReason> = {
    bank_not_available: "BANK_DOWN",
    bank_cutoff_in_progress: "BANK_DOWN",
    gateway_technical_error: "BANK_DOWN",
    bank_technical_error: "BANK_DOWN",
    payment_declined_due_to_high_traffic: "BANK_DOWN",
    otp_expired: "OTP_TIMEOUT",
    incorrect_otp: "OTP_TIMEOUT",
    payment_cancelled: "USER_CANCELLED",
    psp_not_available: "UPI_APP_ERROR",
    psp_app_not_available: "UPI_APP_ERROR",
    psp_app_not_supported: "UPI_APP_ERROR",
    authorisation_declined_by_psp: "UPI_APP_ERROR",
    payment_collect_request_expired: "UPI_APP_ERROR",
    card_expired: "CARD_EXPIRED",
    payment_session_expired: "CART_ABANDONED",
  };
  if (map[exact]) return map[exact];
  if (/insufficient|low balance|not enough funds/.test(text))
    return "INSUFFICIENT_FUNDS";
  if (/limit exceed|exceeds.*limit|daily limit/.test(text))
    return "LIMIT_EXCEEDED";
  if (/expired card|card.*expir/.test(text)) return "CARD_EXPIRED";
  if (/otp|authentication.*tim(e|ed).*out/.test(text)) return "OTP_TIMEOUT";
  if (
    /bank.*(down|unavailable|technical|offline)|issuer.*unavailable|gateway.*(unavailable|technical)/.test(
      text,
    )
  )
    return "BANK_DOWN";
  if (/cancel|customer.*abort/.test(text)) return "USER_CANCELLED";
  if (/network|connection|internet/.test(text)) return "NETWORK_DROP";
  if (/declin|do not honor|do not honour|risk.*(reject|fail)/.test(text))
    return input.method === "upi"
      ? "UPI_APP_ERROR"
      : input.method && input.method !== "card"
        ? "UNKNOWN"
        : "CARD_DECLINED";
  if (input.method === "upi" && /app|intent|collect.*fail|vpa/.test(text))
    return "UPI_APP_ERROR";
  if (
    ["bank", "issuer_bank", "acquiring_bank", "gateway"].includes(
      input.error_source ?? "",
    ) &&
    /timeout|timed out/.test(text)
  )
    return "BANK_DOWN";
  if (
    input.error_step === "payment_authentication" &&
    /timeout|timed out/.test(text)
  )
    return "OTP_TIMEOUT";
  return "UNKNOWN";
}
