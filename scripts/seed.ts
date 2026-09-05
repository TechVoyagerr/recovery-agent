import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
async function main() {
  const { seed } = await import("../src/lib/seed");
  const { db } = await import("../src/lib/db");
  try {
    console.log(await seed());
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error("Seed failed");
  process.exitCode = 1;
});
