"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Stats } from "@/lib/types";
import {
  channelLabel,
  money,
  moneyShort,
  num,
  reasonLabel,
  toPercent,
} from "@/components/lib/format";
import { EmptyState } from "@/components/ui/primitives";

const AXIS = { fontSize: 11, fill: "rgb(var(--text-subtle))" };
const DANGER = "#CF5A52";
const SUCCESS = "#2F9E68";
const BLUE = "#2B84EA";

function TooltipShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[6px] border border-line bg-surface px-3 py-2 shadow-overlay">
      {children}
    </div>
  );
}

function shortBucket(bucket: string): string {
  const d = new Date(bucket);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("en-IN", { hour: "numeric", hour12: true });
}

/* ------------------------------------------------------------ timeline */

interface TimelinePoint {
  bucket: string;
  failed: number;
  recovered: number;
  revenueRecoveredPaise: number;
}

export function RecoveryTimelineChart({ data }: { data: Stats["timeline"] }) {
  if (!data?.length) {
    return <EmptyState title="No timeline yet" />;
  }
  return (
    <div className="h-[260px] px-2 pb-5">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradFailed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={DANGER} stopOpacity={0.08} />
              <stop offset="100%" stopColor={DANGER} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradRecovered" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SUCCESS} stopOpacity={0.08} />
              <stop offset="100%" stopColor={SUCCESS} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
          <XAxis
            dataKey="bucket"
            tickFormatter={shortBucket}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: "rgb(var(--border-strong))" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as TimelinePoint;
              return (
                <TooltipShell>
                  <p className="text-[11px] uppercase tracking-[0.04em] text-subtle">
                    {shortBucket(p.bucket)}
                  </p>
                  <p className="tnum mt-1.5 text-[12.5px] text-danger">{num(p.failed)} failed</p>
                  <p className="tnum text-[12.5px] text-success">{num(p.recovered)} recovered</p>
                  <p className="tnum mt-1 text-[12px] text-muted">
                    {money(p.revenueRecoveredPaise)}
                  </p>
                </TooltipShell>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="failed"
            stroke={DANGER}
            strokeWidth={1.5}
            fill="url(#gradFailed)"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="recovered"
            stroke={SUCCESS}
            strokeWidth={1.5}
            fill="url(#gradRecovered)"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* -------------------------------------------------------------- reason */

export function ReasonBars({ data }: { data: Stats["byReason"] }) {
  const rows = React.useMemo(
    () =>
      [...(data ?? [])]
        .filter((r) => r.failed > 0)
        .sort((a, b) => b.failed - a.failed)
        .slice(0, 8),
    [data],
  );

  if (!rows.length) {
    return <EmptyState title="Nothing diagnosed yet" />;
  }

  const max = Math.max(...rows.map((r) => r.failed));

  return (
    <ul className="space-y-3 px-5 pb-5">
      {rows.map((r) => {
        const rate = toPercent(r.rate);
        return (
          <li key={r.reason}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-ink">{reasonLabel(r.reason)}</span>
              <span className="tnum text-[12px] text-subtle">
                {num(r.failed)} · {moneyShort(r.revenueRecoveredPaise)} ·{" "}
                <span className="text-muted">{rate.toFixed(0)}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-surface3">
              <div className="h-full bg-line-strong" style={{ width: `${(r.failed / max) * 100}%` }}>
                <div
                  className="h-full bg-success transition-[width] duration-200 ease-out"
                  style={{ width: `${rate}%` }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------- channel */

export function ChannelChart({ data }: { data: Stats["byChannel"] }) {
  const rows = React.useMemo(
    () =>
      (data ?? [])
        .filter((c) => c.attempts > 0)
        .map((c) => ({
          ...c,
          label: channelLabel(c.channel),
          ratePct: toPercent(c.rate),
        })),
    [data],
  );

  if (!rows.length) {
    return <EmptyState title="No nudges sent yet" />;
  }

  return (
    <div className="h-[236px] px-2 pb-5">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgb(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={44}
            unit="%"
            domain={[0, 100]}
          />
          <Tooltip
            cursor={{ fill: "rgb(var(--surface-2))" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof rows)[number];
              return (
                <TooltipShell>
                  <p className="text-[13px] text-ink">{p.label}</p>
                  <p className="tnum mt-1 text-[12px] text-muted">
                    {num(p.recovered)} of {num(p.attempts)} · {p.ratePct.toFixed(1)}%
                  </p>
                </TooltipShell>
              );
            }}
          />
          <Bar dataKey="ratePct" fill={BLUE} radius={[2, 2, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
