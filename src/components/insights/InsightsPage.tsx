"use client";

import * as React from "react";
import type { LearningResponse } from "@/lib/types";
import { usePoll } from "@/components/lib/usePoll";
import {
  CHANNEL_OPTIONS,
  channelLabel,
  num,
  reasonLabel,
  toPercent,
} from "@/components/lib/format";
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  cx,
} from "@/components/ui/primitives";
import { ChannelIcon } from "@/components/agent/MessageBubble";

/** Single-hue blue ramp; unlit cells stay on surface so a 0% cell is not mistaken for "no data". */
function cellStyle(rate: number | null): React.CSSProperties {
  if (rate === null) return { background: "rgb(var(--surface-2))" };
  const t = Math.max(0, Math.min(1, rate / 100));
  return {
    background: `color-mix(in srgb, #2B84EA ${6 + t * 74}%, rgb(var(--surface-2)))`,
    color: t > 0.55 ? "#ffffff" : "rgb(var(--text))",
  };
}

export function InsightsPage() {
  const { data, error, loading, refresh } = usePoll<LearningResponse>("/api/learning", 5000);
  const first = loading && !data;

  const channels = React.useMemo(() => {
    const present = new Set((data?.matrix ?? []).map((m) => m.channel));
    const ordered = CHANNEL_OPTIONS.filter((c) => present.has(c));
    return ordered.length ? ordered : (["whatsapp", "sms", "email"] as string[]);
  }, [data]);

  const reasons = React.useMemo(() => {
    const seen: string[] = [];
    for (const m of data?.matrix ?? []) if (!seen.includes(m.reason)) seen.push(m.reason);
    return seen;
  }, [data]);

  const lookup = React.useMemo(() => {
    const map = new Map<string, { rate: number; n: number }>();
    for (const m of data?.matrix ?? []) {
      map.set(`${m.reason}|${m.channel}`, { rate: toPercent(m.rate), n: m.n });
    }
    return map;
  }, [data]);

  const totals = React.useMemo(() => {
    const stats = data?.stats ?? [];
    const successes = stats.reduce((a, s) => a + s.successes, 0);
    const failures = stats.reduce((a, s) => a + s.failures, 0);
    const observations = successes + failures;
    const best = [...(data?.matrix ?? [])]
      .filter((m) => m.n >= 3)
      .sort((a, b) => toPercent(b.rate) - toPercent(a.rate))[0];
    return { successes, failures, observations, best, combos: (data?.matrix ?? []).length };
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader title="Insights" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <LearnStat label="Outcomes" value={num(totals.observations)} loading={first} />
        <LearnStat label="Successes" value={num(totals.successes)} loading={first} />
        <LearnStat label="Strategies" value={num(totals.combos)} loading={first} />
        <LearnStat
          label="Best pairing"
          value={totals.best ? `${toPercent(totals.best.rate).toFixed(0)}%` : first ? "" : "-"}
          meta={
            totals.best
              ? `${reasonLabel(totals.best.reason)} · ${channelLabel(totals.best.channel)}`
              : undefined
          }
          loading={first}
        />
      </div>

      <Card>
        <CardHeader
          title="Reason × channel"
          action={
            <div className="flex items-center gap-2 text-[11px] text-subtle">
              <span>0%</span>
              <span className="h-1.5 w-20 rounded-full bg-[linear-gradient(90deg,rgb(var(--surface-2)),#2B84EA)]" />
              <span>100%</span>
            </div>
          }
        />
        {first ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : error && !data ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : !reasons.length ? (
          <EmptyState title="Nothing learned yet" />
        ) : (
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full min-w-[640px] border-separate border-spacing-[3px]">
              <thead>
                <tr>
                  <th className="w-[200px] px-2 pb-2 text-left text-[11px] font-normal uppercase tracking-[0.04em] text-subtle">
                    Reason
                  </th>
                  {channels.map((c) => (
                    <th key={c} className="px-2 pb-2 text-center">
                      <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.04em] text-subtle">
                        <ChannelIcon channel={c} />
                        {channelLabel(c)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reasons.map((r) => (
                  <tr key={r}>
                    <th
                      scope="row"
                      className="px-2 text-left text-[13px] font-normal text-ink"
                    >
                      {reasonLabel(r)}
                    </th>
                    {channels.map((c) => {
                      const cell = lookup.get(`${r}|${c}`) ?? null;
                      return (
                        <td key={c} className="p-0">
                          <div
                            className="flex h-[44px] flex-col items-center justify-center rounded-[4px]"
                            style={cellStyle(cell ? cell.rate : null)}
                            title={
                              cell
                                ? `${reasonLabel(r)} on ${channelLabel(c)}: ${cell.rate.toFixed(1)}% over ${cell.n} attempts`
                                : `${reasonLabel(r)} on ${channelLabel(c)}: not tried yet`
                            }
                          >
                            {cell ? (
                              <>
                                <span className="tnum text-[13px] font-medium leading-none">
                                  {cell.rate.toFixed(0)}%
                                </span>
                                <span className="tnum mt-0.5 text-[10.5px] opacity-60">{cell.n}</span>
                              </>
                            ) : (
                              <span className="text-[11px] text-subtle">-</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div>
        <h2 className="mb-3 text-[13.5px] font-semibold tracking-[-0.005em] text-ink">
          Conclusions
        </h2>
        {first ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : !data?.insights?.length ? (
          <Card>
            <EmptyState title="No conclusions yet" />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.insights.map((insight, i) => (
              <div key={i} className="rounded-[8px] border border-line bg-surface p-5">
                <p className="text-[13px] leading-[1.6] text-ink">{insight}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardHeader title="Policy table" />
        {!data?.stats?.length ? (
          <EmptyState title="No policy rows yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-y border-line">
                  {["Reason", "Channel", "Timing", "Won", "Lost", "Win rate"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className={cx(
                        "px-4 py-2 text-[11px] font-normal uppercase tracking-[0.04em] text-subtle",
                        (h === "Won" || h === "Lost") && "text-right",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...data.stats]
                  .sort(
                    (a, b) =>
                      b.successes + b.failures - (a.successes + a.failures) ||
                      b.successes - a.successes,
                  )
                  .map((s) => {
                    const n = s.successes + s.failures;
                    const rate = n ? (s.successes / n) * 100 : 0;
                    return (
                      <tr key={s.id} className="border-b border-line">
                        <td className="px-4 py-2 text-[13px] text-ink">{reasonLabel(s.reason)}</td>
                        <td className="px-4 py-2 text-[13px] text-muted">
                          {channelLabel(s.channel)}
                        </td>
                        <td className="px-4 py-2 font-mono text-[11.5px] text-subtle">
                          {s.timingBucket}
                        </td>
                        <td className="tnum px-4 py-2 text-right text-[13px] text-muted">
                          {num(s.successes)}
                        </td>
                        <td className="tnum px-4 py-2 text-right text-[13px] text-muted">
                          {num(s.failures)}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2.5">
                            <div className="h-[3px] w-16 overflow-hidden rounded-full bg-surface3">
                              <div className="h-full rounded-full bg-rzp" style={{ width: `${rate}%` }} />
                            </div>
                            <span className="tnum text-[12.5px] text-ink">{rate.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function LearnStat({
  label,
  value,
  meta,
  loading,
}: {
  label: string;
  value: string;
  meta?: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-[8px] border border-line bg-surface px-5 py-4">
      <p className="text-[11px] uppercase tracking-[0.04em] text-subtle">{label}</p>
      {loading ? (
        <Skeleton className="mt-3.5 h-8 w-24" />
      ) : (
        <p className="tnum mt-3 text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink">
          {value}
        </p>
      )}
      <p className="mt-2.5 truncate text-[12px] text-subtle">{meta ?? " "}</p>
    </div>
  );
}
