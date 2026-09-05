import { db } from "./db";
export async function seed() {
  const merchant = await db.merchant.upsert({
    where: { id: "merchant_demo" },
    create: { id: "merchant_demo", name: "Chai Point Demo Store" },
    update: {},
  });
  const first = [
    "Aarav",
    "Vivaan",
    "Aditya",
    "Arjun",
    "Sai",
    "Ishaan",
    "Kabir",
    "Rohan",
    "Ananya",
    "Diya",
    "Isha",
    "Kavya",
    "Meera",
    "Priya",
    "Saanvi",
    "Zoya",
    "Neha",
    "Rahul",
    "Aditi",
    "Vikram",
  ];
  const last = [
    "Sharma",
    "Patel",
    "Iyer",
    "Gupta",
    "Reddy",
    "Singh",
    "Nair",
    "Khan",
    "Joshi",
    "Das",
  ];
  const cities = [
    "Bengaluru",
    "Mumbai",
    "Delhi",
    "Pune",
    "Hyderabad",
    "Chennai",
    "Jaipur",
    "Lucknow",
    "Kolkata",
    "Ahmedabad",
  ];
  for (let i = 0; i < 200; i++)
    await db.customer.upsert({
      where: { id: `customer_${String(i + 1).padStart(3, "0")}` },
      create: {
        id: `customer_${String(i + 1).padStart(3, "0")}`,
        merchantId: merchant.id,
        name: `${first[i % 20]} ${last[Math.floor(i / 20)]}`,
        phone: `+9190000${String(i).padStart(5, "0")}`,
        email: `demo.customer${i + 1}@example.com`,
        city: cities[i % 10],
        language: i % 3 === 0 ? "hi" : "en",
        segment: i % 5 === 0 ? "loyal" : i % 3 === 0 ? "new" : "regular",
        optedOut: i % 37 === 0,
      },
      update: {},
    });
  // Only historical simulator rows have known synthetic provenance.
  // Never infer real recovery attribution from an original payment's status.
  await db.recoveryAttempt.updateMany({
    where: { outcome: "RECOVERED", attribution: null, paymentLinkId: { not: null },
      transaction: { simulationRunId: { not: null } } },
    data: { attribution: "SIMULATED_LINK" },
  });
  return { merchant: merchant.name, customers: await db.customer.count() };
}
export async function reset() {
  await db.$transaction([
    db.messageEvent.deleteMany(),
    db.agentEvent.deleteMany(),
    db.recoveryAttempt.deleteMany(),
    db.transaction.deleteMany(),
    db.customer.deleteMany(),
    db.merchant.deleteMany(),
    db.learningStat.deleteMany(),
    db.llmCache.deleteMany(),
    db.webhookReceipt.deleteMany(),
    db.simulationRun.deleteMany(),
  ]);
  return seed();
}
