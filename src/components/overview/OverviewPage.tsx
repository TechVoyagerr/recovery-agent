"use client";

import * as React from "react";
import type { SimulationProgress, Stats } from "@/lib/types";
import { usePoll } from "@/components/lib/usePoll";
import { minutes, money, num } from "@/components/lib/format";
import { Button, Card, CardHeader, ErrorState, PageHeader } from "@/components/ui/primitives";
import { KpiCard } from "@/components/overview/KpiCard";
import { ChannelChart, ReasonBars, RecoveryTimelineChart } from "@/components/overview/Charts";

export function OverviewPage() {
  const { data, error, loading, refresh } = usePoll<Stats>("/api/stats", 1000);
  const [runId, setRunId] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<SimulationProgress | null>(null);
  const [busy, setBusy] = React.useState<"sim" | "reset" | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Poll the running simulation until it finishes.
  React.useEffect(() => {
    if (!runId) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/simulate/${runId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as SimulationProgress;
        if (stop) return;
        setProgress(json);
        if (["done", "completed", "error", "failed"].includes(json.status.toLowerCase())) {
          if (json.status.toLowerCase() === "failed") setNotice(json.error || "Simulation interrupted. Please start another run.");
          setRunId(null);
          setBusy(null);
          refresh();
        }
      } catch {
        if (!stop) {
          setRunId(null);
          setBusy(null);
        }
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 700);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [runId, refresh]);

  const runSimulation = async () => {
    setBusy("sim");
    setNotice(null);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ n: 200, speed: "live" }),
      });
      if (!res.ok) {
        const failure = await res.json();
        throw new Error(failure.error || `Request failed (${res.status})`);
      }
      const json = (await res.json()) as { runId: string };
      setProgress(null);
      setRunId(json.runId);
    } catch (error) {
      setBusy(null);
      setNotice(error instanceof Error ? error.message : "Could not start the simulation.");
    }
  };

  const resetData = async () => {
    setBusy("reset");
    setNotice(null);
    try {
      const res = await fetch("/api/reset", { method: "POST" });
      if (!res.ok) {
        const failure = await res.json();
        throw new Error(failure.error || `Request failed (${res.status})`);
      }
      setProgress(null);
      refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Reset failed.");
    } finally {
      setBusy(null);
    }
  };

  const s = data;
  const first = loading && !s;
  const total = progress?.n ?? 200;
  const done = Math.min(progress?.processed ?? 0, total);
  const percentDone = total ? (done / total) * 100 : 0;
  const running = Boolean(runId);
  const recoveryRate = s ? (s.recoveryRate > 1 ? s.recoveryRate : s.recoveryRate * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue recovery"
        actions={
          <>
            <Button variant="primary" onClick={runSimulation} disabled={busy !== null}>
              {running ? "Running…" : "Simulate"}
            </Button>
            <Button variant="danger" onClick={resetData} disabled={busy !== null}>
              Reset
            </Button>
          </>
        }
      />

      {notice ? (
        <div className="rounded-[6px] border border-line px-4 py-2.5 text-[13px] text-danger">
          {notice}
        </div>
      ) : null}

      {running || progress ? (
        <Card className="px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-muted">
              {running ? "Replaying traffic" : "Simulation complete"}
            </span>
            <span className="tnum text-[13px] text-ink">
              {num(done)} / {num(total)}
            </span>
          </div>
          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-surface3">
            <div
              className="h-full bg-rzp transition-[width] duration-200 ease-linear"
              style={{ width: `${percentDone}%` }}
            />
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Recovered"
          value={s?.revenueRecoveredPaise ?? 0}
          format={(n) => money(n)}
          meta={`${num(s?.recovered ?? 0)} payments`}
          loading={first}
        />
        <KpiCard
          label="Recovery rate"
          value={recoveryRate}
          format={(n) => `${n.toFixed(1)}%`}
          meta={`${num(s?.recovered ?? 0)} of ${num(s?.totalFailed ?? 0)}`}
          loading={first}
        />
        <KpiCard
          label="At risk"
          value={s?.revenueAtRiskPaise ?? 0}
          format={(n) => money(n)}
          meta={`${num(s?.totalFailed ?? 0)} failures`}
          loading={first}
        />
        <KpiCard
          label="Avg time to recover"
          value={s?.avgRecoveryMinutes ?? 0}
          format={(n) => minutes(n)}
          loading={first}
        />
        <KpiCard
          label="Active"
          value={s?.activeRecoveries ?? 0}
          format={(n) => num(n)}
          meta="awaiting customer"
          loading={first}
        />
      </div>

      {error && !s ? (
        <Card>
          <ErrorState message={error} onRetry={refresh} />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Failures vs recoveries"
              action={
                <div className="flex items-center gap-3 text-[12px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-danger" /> Failed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-success" /> Recovered
                  </span>
                </div>
              }
            />
            <RecoveryTimelineChart data={s?.timeline ?? []} />
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="By failure reason" />
              <ReasonBars data={s?.byReason ?? []} />
            </Card>
            <Card>
              <CardHeader title="Channel win rate" />
              <ChannelChart data={s?.byChannel ?? []} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
