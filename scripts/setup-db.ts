import { config } from "dotenv";
import { execFileSync } from "node:child_process";
config({ path: ".env.local", quiet: true });
process.env.DATABASE_URL ||= "file:./dev.db";
execFileSync("npx", ["prisma", "db", "push"], { stdio: "inherit", env: process.env });
async function initialize() {
  const { db } = await import("../src/lib/db");
  const { seed } = await import("../src/lib/seed");
  try {
    // This runs before the server starts, so previous RUNNING rows are orphaned.
    await db.simulationRun.updateMany({
      where: { status: "RUNNING" },
      data: { status: "FAILED", completedAt: new Date(), error: "Server restarted during simulation" },
    });
    console.log(await seed());
  } finally {
    await db.$disconnect();
  }
}
initialize().catch((error) => {
  console.error("Database initialization failed", error);
  process.exitCode = 1;
});
