import { config } from "dotenv";
import { execFileSync } from "node:child_process";
config({ path: ".env.local", quiet: true });
process.env.DATABASE_URL ||= "file:./dev.db";
execFileSync("npx", ["prisma", "db", "push"], { stdio: "inherit", env: process.env });
void import("./seed");
