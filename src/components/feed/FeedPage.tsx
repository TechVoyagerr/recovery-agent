"use client";

import * as React from "react";
import type { AgentEvent, FailureReason, PaymentMethod, Transaction } from "@/lib/types";
import type { Tone } from "@/components/lib/format";
import {
  METHOD_OPTIONS,
  REASON_OPTIONS,
  methodLabel,
  reasonLabel,
  relative,
} from "@/components/lib/format";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  ReasoningBlock,
  Skeleton,
  cx,
} from "@/components/ui/primitives";
import { DecisionCard } from "@/components/agent/DecisionCard";

const MAX_EVENTS = 120;

/** Maps an agent event type onto a pipeline stage chip. */
function stageOf(type: string): { label: string; tone: Tone } {
  const t = type.toLowerCase();
  if (t.includes("fail") || t.includes("detect")) return { label: "Detect", tone: "danger" };
  if (t.includes("diagnos") || t.includes("classif")) return { label: "Diagnose", tone: "warning" };
  if (t.includes("decid") || t.includes("decision") || t.includes("strategy"))
    return { label: "Decide", tone: "info" };
  if (t.includes("link") || t.includes("sent") || t.includes("send") || t.includes("nudge"))
    return { label: "Act", tone: "info" };
  if (t.includes("recover") || t.includes("paid")) return { label: "Recovered", tone: "success" };
  if (t.includes("learn")) return { label: "Learn", tone: "neutral" };
  return { label: "Agent", tone: "neutral" };
}

const SKIP_DETAIL = new Set(["reasoning", "message"]);

function detailLines(detail: Record<string, unknown> | undefined): string[] {
  if (!detail || typeof detail !== "object") return [];
  return Object.entries(detail)
    .filter(([k, v]) => v !== null && v !== undefined && typeof v !== "object" && !SKIP_DETAIL.has(k))
    .slice(0, 4)
    .map(([k, v]) => {
      const value = String(v);
      return `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${
        value.length > 44 ? `${value.slice(0, 44)}…` : value
      }`;
    });
}

export function FeedPage() {
  const [events, setEvents] = React.useState<AgentEvent[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [connected, setConnected] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [decision, setDecision] = React.useState<Transaction | null>(null);

  const merge = React.useCallback((incoming: AgentEvent[]) => {
    setEvents((prev) => {
      const seen = new Set((prev ?? []).map((e) => e.id));
      const fresh = incoming.filter((e) => !seen.has(e.id));
      if (!fresh.length) return prev ?? [];
      return [...fresh, ...(prev ?? [])].slice(0, MAX_EVENTS);
    });
  }, []);

  // Seed from the REST feed, then upgrade to SSE; fall back to polling if SSE dies.
  React.useEffect(() => {
    let stopped = false;
    let source: EventSource | null = null;
    let pollId: number | null = null;

    const loadOnce = async () => {
      try {
        const res = await fetch("/api/agent/feed?limit=50", { cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = (await res.json()) as AgentEvent[];
        if (stopped) return;
        setEvents((prev) => {
          if (!prev) return json.slice(0, MAX_EVENTS);
          const seen = new Set(prev.map((e) => e.id));
          const fresh = json.filter((e) => !seen.has(e.id));
          return [...fresh, ...prev].slice(0, MAX_EVENTS);
        });
        setError(null);
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : "feed unavailable");
      }
    };

    const startPolling = () => {
      if (pollId !== null) return;
      pollId = window.setInterval(() => void loadOnce(), 5000);
    };

    void loadOnce().then(() => {
      if (stopped) return;
      try {
        source = new EventSource("/api/agent/events");
        source.onopen = () => setConnected(true);
        source.onmessage = (ev) => {
          try {
            const parsed = JSON.parse(ev.data) as AgentEvent | AgentEvent[];
            merge(Array.isArray(parsed) ? parsed : [parsed]);
            setError(null);
          } catch {
            /* a keep-alive or non-JSON frame - ignore */
          }
        };
        source.onerror = () => {
          setConnected(false);
          startPolling();
        };
      } catch {
        startPolling();
      }
    });

    return () => {
      stopped = true;
      source?.close();
      if (pollId !== null) window.clearInterval(pollId);
    };
  }, [merge]);

  const loading = events === null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent feed"
        actions={
          <>
            <span className="hidden items-center gap-2 pr-1 sm:inline-flex">
              <span
                className={cx("size-1.5 rounded-full", connected ? "bg-success" : "bg-warning")}
              />
              <span className="text-[12px] text-muted">{connected ? "Streaming" : "Polling"}</span>
            </span>
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              Trigger failure
            </Button>
          </>
        }
      />

      {decision ? (
        <div>
          <p className="mb-2.5 text-[11px] uppercase tracking-[0.04em] text-subtle">
            Latest decision
          </p>
          <DecisionCard txn={decision} />
        </div>
      ) : null}

      <Card>
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[13.5px] font-semibold tracking-[-0.005em] text-ink">Events</h2>
          <span className="tnum text-[12px] text-subtle">{events?.length ?? 0}</span>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : error && !events.length ? (
          <ErrorState message={error} />
        ) : !events.length ? (
          <EmptyState
            title="No events yet"
            action={
              <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
                Trigger failure
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line" aria-live="polite">
            {events.map((ev, i) => {
              const stage = stageOf(ev.type);
              const lines = detailLines(ev.detail);
              const reasoning =
                typeof ev.detail?.reasoning === "string" ? (ev.detail.reasoning as string) : null;
              return (
                <li
                  key={ev.id}
                  className={cx(
                    "flex gap-3.5 px-5 py-3.5 transition-colors duration-150 hover:bg-surface2",
                    i === 0 && "animate-feed-in",
                  )}
                >
                  <div className="flex flex-col items-center pt-[7px]">
                    <span
                      className={cx(
                        "size-1.5 shrink-0 rounded-full",
                        stage.tone === "danger" && "bg-danger",
                        stage.tone === "warning" && "bg-warning",
                        stage.tone === "info" && "bg-rzp",
                        stage.tone === "success" && "bg-success",
                        stage.tone === "neutral" && "bg-line-strong",
                      )}
                    />
                    <span className="mt-1.5 w-px flex-1 bg-line" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2.5">
                      <span className="w-[68px] shrink-0 text-[11px] uppercase tracking-[0.04em] text-subtle">
                        {stage.label}
                      </span>
                      <span className="text-[13px] text-ink">{ev.title}</span>
                      <span className="ml-auto text-[11.5px] text-subtle">
                        {relative(ev.createdAt)}
                      </span>
                    </div>
                    {reasoning ? (
                      <div className="mt-2 pl-[78px]">
                        <ReasoningBlock>{reasoning}</ReasoningBlock>
                      </div>
                    ) : null}
                    {lines.length ? (
                      <p className="mt-1.5 truncate pl-[78px] font-mono text-[11px] leading-[1.6] text-subtle">
                        {lines.join("  ·  ")}
                      </p>
                    ) : null}
                    {ev.transactionId ? (
                      <p className="mt-1 pl-[78px] font-mono text-[11px] text-subtle">
                        {ev.transactionId}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <TriggerFailureModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(txn) => {
          setDecision(txn);
          setModalOpen(false);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------ Trigger failure modal */

function TriggerFailureModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (txn: Transaction) => void;
}) {
  const [reason, setReason] = React.useState<FailureReason>("OTP_TIMEOUT");
  const [method, setMethod] = React.useState<PaymentMethod>("upi");
  const [amount, setAmount] = React.useState("2499");
  const [submitting, setSubmitting] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      const rupees = Math.max(1, Math.round(Number(amount) || 0));
      const res = await fetch("/api/demo/fail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountPaise: rupees * 100, reason, method }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const txn = (await res.json()) as Transaction;
      onCreated(txn);
    } catch {
      setErr("The recovery service did not accept that failure. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Trigger failure"
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-[0.04em] text-subtle">
            Failure reason
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REASON_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                aria-pressed={reason === r}
                className={cx(
                  "rounded-[6px] border px-2.5 py-1 text-[12px] transition-colors duration-150",
                  reason === r
                    ? "border-rzp bg-rzp text-white"
                    : "border-line text-muted hover:text-ink",
                )}
              >
                {reasonLabel(r)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[0.04em] text-subtle">
              Method
            </p>
            <div className="flex gap-1.5">
              {METHOD_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  aria-pressed={method === m}
                  className={cx(
                    "flex-1 rounded-[6px] border px-2 py-1.5 text-[12px] transition-colors duration-150",
                    method === m
                      ? "border-rzp text-rzp-bright"
                      : "border-line text-muted hover:text-ink",
                  )}
                >
                  {methodLabel(m)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label
              htmlFor="amount"
              className="mb-2 block text-[11px] uppercase tracking-[0.04em] text-subtle"
            >
              Amount (₹)
            </label>
            <input
              id="amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              className="tnum h-9 w-full rounded-[6px] border border-line bg-surface2 px-2.5 text-[13px] text-ink transition-colors duration-150 hover:border-line-strong"
            />
          </div>
        </div>

        {err ? <p className="text-[12.5px] text-danger">{err}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Working…" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
