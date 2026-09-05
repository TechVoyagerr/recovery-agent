"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PollState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/** Fetches `url` on mount and every `intervalMs`, keeping the last good payload on error. */
export function usePoll<T>(url: string | null, intervalMs = 5000): PollState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = (await res.json()) as T;
      if (!alive.current) return;
      setData(json);
      setError(null);
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, tick]);

  useEffect(() => {
    if (!url || intervalMs <= 0) return;
    const id = window.setInterval(() => void load(), intervalMs);
    return () => window.clearInterval(id);
  }, [load, intervalMs, url]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return { data, error, loading, refresh };
}

/** Counts a number up on mount and animates smoothly between subsequent values. */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
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
