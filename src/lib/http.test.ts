import { afterEach, describe, expect, it, vi } from "vitest";
import { api, demoGuard } from "./http";

afterEach(() => vi.unstubAllEnvs());
describe("production demo authorization", () => {
  it("allows public demo mutations only with an explicit true flag", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_API_TOKEN", "");
    vi.stubEnv("DEMO_PUBLIC", "true");
    expect(demoGuard(new Request("http://test/api/reset"))).toBeNull();
    vi.stubEnv("DEMO_PUBLIC", "false");
    expect(demoGuard(new Request("http://test/api/reset"))?.status).toBe(403);
    vi.stubEnv("DEMO_PUBLIC", "TRUE");
    expect(demoGuard(new Request("http://test/api/reset"))?.status).toBe(403);
  });
  it("requires the correct bearer token when the public flag is off", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_PUBLIC", "false");
    vi.stubEnv("DEMO_API_TOKEN", "test-token");
    expect(demoGuard(new Request("http://test/api/reset"))?.status).toBe(401);
    expect(demoGuard(new Request("http://test/api/reset", {
      headers: { authorization: "Bearer test-token" },
    }))).toBeNull();
  });
});

describe("API diagnostics", () => {
  it("logs the original server error while keeping its details out of the response", async () => {
    const error = new Error("Prisma validation failed: unknown argument attribution");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await api(async () => { throw error; });
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Request failed" });
      expect(log).toHaveBeenCalledWith("API request failed", error);
    } finally {
      log.mockRestore();
    }
  });
});
