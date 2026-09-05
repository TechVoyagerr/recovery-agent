async function main() {
const { spawnSync, spawn } = await import("node:child_process");
const { mkdirSync } = await import("node:fs");
const { dirname, isAbsolute } = await import("node:path");

process.env.NODE_ENV ||= "production";
process.env.DATABASE_URL ||= "file:/data/dev.db";
process.env.AGENT_LLM ||= "off";
process.env.HOSTNAME = "0.0.0.0";
process.env.PORT ||= "10000";
const databasePath = process.env.DATABASE_URL.replace(/^file:/, "");
if (isAbsolute(databasePath)) mkdirSync(dirname(databasePath), { recursive: true });

for (const args of [
  ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"],
  ["node_modules/tsx/dist/cli.mjs", "scripts/init-demo.ts"],
]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", env: process.env });
  if (result.error || result.status !== 0) {
    console.error("Database initialization failed", result.error || result.signal || result.status);
    process.exit(result.status || 1);
  }
}
const server = spawn(process.execPath, ["server.js"], { stdio: "inherit", env: process.env });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.kill(signal));
server.on("error", (error) => { console.error(error); process.exit(1); });
server.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));

}
main().catch((error) => { console.error(error); process.exit(1); });
