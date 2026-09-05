import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCached, readCached, writeCached, FEED_URL } from "./usePoll";

afterEach(() => vi.unstubAllGlobals());

describe("dashboard cache", () => {
  it("retains the last successful snapshot on HTTP and network errors", async () => {
    writeCached("/test/errors", { recovered: 412 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockRejectedValueOnce(new Error("offline")));
    await expect(fetchCached("/test/errors")).rejects.toThrow("503");
    await expect(fetchCached("/test/errors")).rejects.toThrow("offline");
    expect(readCached("/test/errors")).toEqual({ recovered: 412 });
  });
  it("ignores an older response that arrives after the newest request", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; })).mockResolvedValueOnce(Response.json({ recovered: 420 })));
    const old = fetchCached("/test/order");
    await fetchCached("/test/order");
    resolve(Response.json({ recovered: 1 }));
    await old;
    expect(readCached("/test/order")).toEqual({ recovered: 420 });
  });
  it("hydrates and mirrors session storage", () => {
    const storage = new Map([["dashboard-cache:v1:/test/session", '{"recovered":415}']]);
    vi.stubGlobal("window", {});
    vi.stubGlobal("sessionStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
    expect(readCached("/test/session")).toEqual({ recovered: 415 });
    writeCached("/test/session", { recovered: 416 });
    expect(storage.get("dashboard-cache:v1:/test/session")).toBe('{"recovered":416}');
  });
  it("keeps SSE events when a REST snapshot predates them", async () => {
    writeCached(FEED_URL, [{ id: "streamed" }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([{ id: "older" }])));
    await fetchCached(FEED_URL);
    expect(readCached(FEED_URL)).toEqual([{ id: "older" }, { id: "streamed" }]);
  });
});
