import Razorpay from "razorpay";
import { createHash } from "node:crypto";
export async function createPaymentLink(input: {
  id: string;
  transactionId: string;
  amountPaise: number;
  name: string;
  phone: string;
  email: string;
  mock?: boolean;
}) {
  if (
    input.mock ||
    !process.env.RAZORPAY_KEY_ID ||
    !process.env.RAZORPAY_KEY_SECRET
  ) {
    const token = createHash("sha256")
      .update(input.id)
      .digest("hex")
      .slice(0, 12);
    return { id: `plink_mock_${token}`, url: `https://rzp.io/l/mock_${token}` };
  }
  const client = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  const link = await client.paymentLink.create({
    amount: input.amountPaise,
    currency: "INR",
    accept_partial: false,
    description: "Complete your Chai Point order",
    reference_id: input.id,
    customer: {
      name: input.name,
      ...(input.phone ? { contact: input.phone } : {}),
      ...(input.email ? { email: input.email } : {}),
    },
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: { transactionId: input.transactionId },
  });
  return { id: link.id, url: link.short_url };
}
export interface Notifier {
  name: string;
  send(input: {
    channel: string;
    to: string;
    message: string;
    idempotencyKey: string;
  }): Promise<void>;
}
export class ConsoleNotifier implements Notifier {
  name = "console";
  async send(input: {
    channel: string;
    to: string;
    message: string;
    idempotencyKey: string;
  }) {
    console.info(
      `[notifier:console] ${input.channel} attempt=${input.idempotencyKey} delivery=simulated`,
    );
  }
}
let notifier: Notifier = new ConsoleNotifier();
export function setNotifier(value: Notifier) {
  notifier = value;
}
export function getNotifier() {
  return notifier;
}
