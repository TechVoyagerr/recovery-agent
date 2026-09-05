"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const cache = new Map<string, unknown>();
const sequences = new Map<string, number>();
const listeners = new Set<() => void>();
const PREFIX = "dashboard-cache:v1:";
export const FEED_URL = "/api/agent/feed?limit=50";

export function readCached<T>(url: string): T | null {
  if (cache.has(url)) return cache.get(url) as T;
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem(PREFIX + url);
      if (stored !== null) {
        const value = JSON.parse(stored) as T;
        cache.set(url, value);
        return value;
      }
    } catch { /* Storage may be unavailable or full. */ }
  }
  return null;
}

export function writeCached<T>(url: string, value: T) {
  cache.set(url, value);
  try { sessionStorage.setItem(PREFIX + url, JSON.stringify(value)); } catch { /* In-memory cache remains available. */ }
  listeners.forEach((notify) => notify());
}

export async function fetchCached<T>(url: string): Promise<T | null> {
  const sequence = (sequences.get(url) ?? 0) + 1;
  sequences.set(url, sequence);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    let value = await res.json() as T;
    if (sequences.get(url) !== sequence) return readCached<T>(url);
    if (value === null || value === undefined) throw new Error("Empty response");
    if (url === FEED_URL && Array.isArray(value)) {
      const previous = readCached<Array<{ id: string }>>(url) ?? [];
      const incoming = value as Array<{ id: string }>;
      const ids = new Set(incoming.map((event) => event.id));
      value = [...incoming, ...previous.filter((event) => !ids.has(event.id))].slice(0, 120) as T;
    }
    writeCached(url, value);
    return value;
  } catch (error) {
    if (sequences.get(url) !== sequence) return readCached<T>(url);
    throw error;
  }
}

export function prefetchDashboard() {
  for (const url of ["/api/stats", FEED_URL, "/api/transactions?limit=50", "/api/learning"]) {
    void fetchCached(url).catch(() => { /* Keep the last successful snapshot. */ });
  }
}

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => { listeners.delete(notify); };
};
const serverSnapshot = () => null;

export interface PollState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/** Cached snapshots survive route mounts; failed and stale polls cannot erase them. */
export function usePoll<T>(url: string | null, intervalMs = 5000): PollState<T> {
  const snapshot = useCallback(() => url ? readCached<T>(url) : null, [url]);
  const data = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    let active = true;
    let sequence = 0;
    const load = async () => {
      const request = ++sequence;
      try {
        await fetchCached<T>(url);
        if (active && request === sequence) setError(null);
      } catch (e) {
        if (active && request === sequence) setError(e instanceof Error ? e.message : "Request failed");
      }
    };
    void load();
    const id = intervalMs > 0 ? window.setInterval(() => void load(), intervalMs) : null;
    return () => { active = false; if (id !== null) window.clearInterval(id); };
  }, [url, intervalMs, tick]);
  const refresh = useCallback(() => setTick((value) => value + 1), []);
  return { data, error, loading: data === null, refresh };
}

/** Counts a number up on mount and animates smoothly between subsequent values. */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    const to = Number.isFinite(target) ? target : 0;
    if (reduced || from === to) {
      fromRef.current = to;
      setValue(to);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      setValue(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      fromRef.current = value;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}
