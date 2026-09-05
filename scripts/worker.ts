import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
async function main() {
  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });
  process.on("SIGTERM", () => {
    stopping = true;
  });
  while (!stopping) {
    try {
      const response = await fetch(
        `${process.env.AGENT_BASE_URL || "http://localhost:3000"}/api/agent/run`,
        {
          method: "POST",
          headers: process.env.DEMO_API_TOKEN
            ? { Authorization: `Bearer ${process.env.DEMO_API_TOKEN}` }
            : {},
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!response.ok) console.error(`Worker HTTP ${response.status}`);
      else {
        const result = await response.json();
        if (result.processed) console.log(result);
      }
    } catch {
      console.error("Worker could not reach agent API");
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}
void main();
