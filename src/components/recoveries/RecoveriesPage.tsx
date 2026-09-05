"use client";

import * as React from "react";
import type { RecoveryAttempt, Transaction, TransactionsResponse } from "@/lib/types";
import { usePoll } from "@/components/lib/usePoll";
import {
  CHANNEL_OPTIONS,
  CHANNEL_TONE,
  REASON_OPTIONS,
  STATUS_OPTIONS,
  channelLabel,
  methodLabel,
  money,
  reasonLabel,
  relative,
  statusLabel,
  statusTone,
  timeOfDay,
} from "@/components/lib/format";
import {
  Badge,
  Button,
  Card,
  ConfidenceMeter,
  Drawer,
  EmptyState,
  ErrorState,
  PageHeader,
  ReasoningBlock,
  Select,
  Skeleton,
  cx,
} from "@/components/ui/primitives";
import { MessageBubble } from "@/components/agent/MessageBubble";
import { Field } from "@/components/agent/DecisionCard";

export function RecoveriesPage() {
  const [status, setStatus] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [channel, setChannel] = React.useState("");
  const [selected, setSelected] = React.useState<Transaction | null>(null);

  const url = React.useMemo(() => {
    const params = new URLSearchParams({ limit: "50" });
    if (status) params.set("status", status);
    if (reason) params.set("reason", reason);
    if (channel) params.set("channel", channel);
    return `/api/transactions?${params.toString()}`;
  }, [status, reason, channel]);

  const { data, error, loading, refresh } = usePoll<TransactionsResponse>(url, 5000);
  const items = data?.items ?? [];
  const first = loading && !data;
  const filtered = Boolean(status || reason || channel);

  // Keep the open drawer in sync with the freshest poll.
  React.useEffect(() => {
    if (!selected) return;
    const next = items.find((t) => t.id === selected.id);
    if (next && next !== selected) setSelected(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recoveries"
        actions={
          <Button onClick={refresh} size="sm">
            Refresh
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end gap-4 border-b border-line px-5 py-3.5">
          <Select
            label="Status"
            value={status}
            onChange={setStatus}
            allLabel="All statuses"
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: statusLabel(s) }))}
          />
          <Select
            label="Failure reason"
            value={reason}
            onChange={setReason}
            allLabel="All reasons"
            options={REASON_OPTIONS.map((r) => ({ value: r, label: reasonLabel(r) }))}
          />
          <Select
            label="Channel"
            value={channel}
            onChange={setChannel}
            allLabel="All channels"
            options={CHANNEL_OPTIONS.map((c) => ({ value: c, label: channelLabel(c) }))}
          />
          {filtered ? (
            <Button
              size="sm"
              variant="ghost"
              className="mb-0.5"
              onClick={() => {
                setStatus("");
                setReason("");
                setChannel("");
              }}
            >
              Clear
            </Button>
          ) : null}
          <span className="tnum mb-2 ml-auto text-[12px] text-subtle">{items.length}</span>
        </div>

        {first ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : error && !data ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : !items.length ? (
          <EmptyState title={filtered ? "No matches" : "No failed payments yet"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  {["Payment", "Customer", "Amount", "Reason", "Nudge", "Status", "When"].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className={cx(
                        "px-4 py-2 text-[11px] font-normal uppercase tracking-[0.04em] text-subtle",
                        h === "Amount" && "text-right",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((txn) => {
                  const attempt = txn.attempts?.[0];
                  return (
                    <tr
                      key={txn.id}
                      tabIndex={0}
                      role="button"
                      onClick={() => setSelected(txn)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(txn);
                        }
                      }}
                      className={cx(
                        "cursor-pointer border-b border-line transition-colors duration-150 hover:bg-surface2",
                        selected?.id === txn.id && "bg-surface2",
                      )}
                    >
                      <td className="px-4 py-2.5 font-mono text-[11.5px] text-subtle">{txn.id}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-[13px] text-ink">{txn.customer?.name ?? "-"}</p>
                        <p className="text-[11.5px] text-subtle">{txn.customer?.city ?? ""}</p>
                      </td>
                      <td className="tnum px-4 py-2.5 text-right text-[13px] text-ink">
                        {money(txn.amountPaise)}
                        <span className="ml-1.5 text-[11.5px] text-subtle">
                          {methodLabel(txn.method)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-muted">
                        {reasonLabel(txn.failureReason)}
                      </td>
                      <td className="px-4 py-2.5">
                        {attempt ? (
                          <Badge tone={CHANNEL_TONE[attempt.channel] ?? "info"} muted>
                            {channelLabel(attempt.channel)}
                          </Badge>
                        ) : (
                          <span className="text-[12px] text-subtle">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={statusTone(txn.status)} muted>
                          {statusLabel(txn.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-subtle">
                        {relative(txn.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `${money(selected.amountPaise)} · ${reasonLabel(selected.failureReason)}` : ""}
        subtitle={selected?.id}
      >
        {selected ? <RecoveryTimeline txn={selected} /> : null}
      </Drawer>
    </div>
  );
}

/* ---------------------------------------------------------- the timeline */

function Step({
  tone,
  title,
  meta,
  children,
  last,
}: {
  tone: "danger" | "warning" | "info" | "success" | "neutral";
  title: string;
  meta?: string;
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-4 pb-5">
      {!last ? <span className="absolute left-[3px] top-4 h-full w-px bg-line" /> : null}
      <span
        className={cx(
          "relative z-10 mt-[7px] size-1.5 shrink-0 rounded-full ring-4 ring-surface",
          tone === "danger" && "bg-danger",
          tone === "warning" && "bg-warning",
          tone === "info" && "bg-rzp",
          tone === "success" && "bg-success",
          tone === "neutral" && "bg-line-strong",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[13px] font-medium text-ink">{title}</p>
          {meta ? <span className="text-[11.5px] text-subtle">{meta}</span> : null}
        </div>
        {children ? <div className="mt-2 space-y-2.5">{children}</div> : null}
      </div>
    </li>
  );
}

function RecoveryTimeline({ txn }: { txn: Transaction }) {
  const attempts: RecoveryAttempt[] = txn.attempts ?? [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <Badge tone={statusTone(txn.status)} muted>
            {statusLabel(txn.status)}
          </Badge>
        </Field>
        <Field label="Method">
          <span className="text-[13px] text-ink">{methodLabel(txn.method)}</span>
        </Field>
        <Field label="Customer">
          <p className="text-[13px] text-ink">{txn.customer?.name ?? "-"}</p>
          <p className="text-[11.5px] text-subtle">
            {[txn.customer?.phone, txn.customer?.city].filter(Boolean).join(" · ")}
          </p>
        </Field>
        <Field label="Amount">
          <p className="tnum text-[18px] font-semibold tracking-[-0.02em] text-ink">
            {money(txn.amountPaise)}
          </p>
        </Field>
      </div>

      <ol className="pt-1">
        <Step tone="danger" title="Payment failed" meta={relative(txn.createdAt)}>
          {txn.errorCode || txn.errorDescription ? (
            <p className="font-mono text-[11.5px] text-subtle">
              {[txn.errorCode, txn.errorDescription].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </Step>

        <Step tone="warning" title={reasonLabel(txn.failureReason)} />

        {attempts.length === 0 ? (
          <Step tone="neutral" title="No attempt yet" last />
        ) : (
          attempts.map((a, i) => {
            const isLast = i === attempts.length - 1;
            return (
              <React.Fragment key={a.id}>
                <Step
                  tone="info"
                  title={`Decision · attempt ${a.attemptNo}`}
                  meta={timeOfDay(a.scheduledAt)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={CHANNEL_TONE[a.channel] ?? "info"} muted>
                      {channelLabel(a.channel)}
                    </Badge>
                    <Badge tone="neutral" dot={false} muted>
                      {a.strategy}
                    </Badge>
                  </div>
                  <ReasoningBlock>{a.reasoning}</ReasoningBlock>
                  <ConfidenceMeter value={a.confidence} />
                </Step>

                <Step
                  tone="info"
                  title={a.paymentLinkUrl ? "Payment link created" : "No link needed"}
                  meta={a.paymentLinkId ?? undefined}
                >
                  {a.paymentLinkUrl ? (
                    <a
                      href={a.paymentLinkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate font-mono text-[11.5px] text-rzp-bright underline-offset-2 hover:underline"
                    >
                      {a.paymentLinkUrl}
                    </a>
                  ) : null}
                </Step>

                <Step
                  tone={a.sentAt ? "success" : "neutral"}
                  title={a.sentAt ? `Nudge sent · ${channelLabel(a.channel)}` : "Nudge queued"}
                  meta={a.sentAt ? relative(a.sentAt) : timeOfDay(a.scheduledAt)}
                >
                  <MessageBubble
                    channel={a.channel}
                    message={a.message}
                    link={a.paymentLinkUrl}
                    to={txn.customer?.phone}
                    sentAt={a.sentAt ? relative(a.sentAt) : "queued"}
                  />
                </Step>

                <Step
                  tone={
                    a.outcome === "RECOVERED"
                      ? "success"
                      : a.outcome === "PENDING"
                        ? "warning"
                        : "neutral"
                  }
                  title={
                    a.outcome === "RECOVERED"
                      ? `Recovered ${money(txn.amountPaise)}`
                      : a.outcome === "PENDING"
                        ? "Awaiting the customer"
                        : `Attempt ${a.outcome.toLowerCase()}`
                  }
                  meta={a.recoveredAt ? relative(a.recoveredAt) : undefined}
                  last={isLast}
                />
              </React.Fragment>
            );
          })
        )}
      </ol>
    </div>
  );
}
