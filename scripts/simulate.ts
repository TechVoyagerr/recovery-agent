import { config } from "dotenv";
import { execFileSync } from "node:child_process";
config({ path: ".env.local", quiet: true });
async function main() {
  const args = process.argv.slice(2);
  const arg = (name: string, fallback: number) => {
    const i = args.indexOf(name);
    return i < 0 ? fallback : Number(args[i + 1]);
  };
  const n = arg("--n", 1000),
    seed = arg("--seed", 42);
  if (!Number.isInteger(n) || n < 1 || n > 10000 || !Number.isInteger(seed))
    throw new Error("Invalid arguments");
  // A dedicated disposable database makes CLI results independent of dashboard traffic.
  process.env.DATABASE_URL = "file:./simulation.db";
  process.env.AGENT_LLM = "off";
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], { env: process.env, stdio: "pipe" });
  const { createRun, executeRun } = await import("../src/lib/simulator");
  const { db } = await import("../src/lib/db");
  try {
    if (await db.simulationRun.count({ where: { status: "RUNNING" } }))
      throw new Error("Simulation already running");
    await (await import("../src/lib/seed")).reset();
    const run = await createRun(n, seed);
    const result = await executeRun(run.id);
    const stats = await (await import("../src/lib/queries")).getStats();
    console.log(JSON.stringify({ ...result, synthetic: true, stats }, null, 2));
    if (result?.status !== "COMPLETED") process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error("Simulation failed; check arguments or active runs");
  process.exitCode = 1;
});
