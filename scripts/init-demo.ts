import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
// Uses the same DATABASE_URL as Next, never the disposable CLI simulation database.
async function main() {
  const { db } = await import("../src/lib/db");
  try {
    const { seed } = await import("../src/lib/seed");
    await seed();
    if (await db.transaction.count() === 0) {
      const { createRun, executeRun } = await import("../src/lib/simulator");
      const run = await createRun(1000, 42);
      const result = await executeRun(run.id, "instant");
      if (result?.status !== "COMPLETED") throw new Error("Startup simulation failed");
      console.log("Dashboard initialized with 1,000 synthetic transactions (seed 42)");
    } else {
      console.log("Existing dashboard transactions preserved");
    }
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
