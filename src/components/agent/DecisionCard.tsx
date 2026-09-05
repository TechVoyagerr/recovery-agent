"use client";

import * as React from "react";
import type { RecoveryAttempt, Transaction } from "@/lib/types";
import {
  CHANNEL_TONE,
  channelLabel,
  dateTime,
  money,
  methodLabel,
  outcomeTone,
  reasonLabel,
  statusLabel,
  statusTone,
  timeOfDay,
} from "@/components/lib/format";
import { Badge, ConfidenceMeter, ReasoningBlock, cx } from "@/components/ui/primitives";
import { MessageBubble } from "@/components/agent/MessageBubble";

const STAGES = ["Detect", "Diagnose", "Decide", "Act", "Learn"] as const;

export function StagePipeline({ activeIndex }: { activeIndex: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STAGES.map((stage, i) => (
        <li key={stage} className="flex items-center gap-2">
          <span
            className={cx(
              "text-[11px] uppercase tracking-[0.04em]",
              i <= activeIndex ? "text-muted" : "text-subtle/60",
            )}
          >
            {stage}
          </span>
          {i < STAGES.length - 1 ? <span className="h-px w-3 bg-line" /> : null}
        </li>
      ))}
    </ol>
  );
}

/** The full "what the agent saw, decided and sent" card for one transaction. */
export function DecisionCard({ txn }: { txn: Transaction }) {
  const attempt: RecoveryAttempt | undefined = txn.attempts?.[0];
  const stage = !attempt ? 1 : attempt.sentAt ? 4 : 3;

  return (
    <div className="animate-fade-in overflow-hidden rounded-[8px] border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <span className="font-mono text-[11.5px] text-subtle">{txn.id}</span>
        <StagePipeline activeIndex={stage} />
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-2">
        <section className="space-y-4">
          <Field label="Diagnosis">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="danger">{reasonLabel(txn.failureReason)}</Badge>
              <Badge tone={statusTone(txn.status)}>{statusLabel(txn.status)}</Badge>
            </div>
          </Field>

          <Field label="Payment">
            <p className="tnum text-[20px] font-semibold tracking-[-0.02em] text-ink">
              {money(txn.amountPaise)}
            </p>
            <p className="mt-1 text-[12.5px] text-muted">
              {methodLabel(txn.method)} · {txn.customer?.name ?? "Customer"} ·{" "}
              {dateTime(txn.createdAt)}
            </p>
          </Field>

          {attempt ? (
            <Field label="Strategy">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={CHANNEL_TONE[attempt.channel] ?? "info"}>
                  {channelLabel(attempt.channel)}
                </Badge>
                <Badge tone="neutral" dot={false} muted>
                  {attempt.strategy}
                </Badge>
                <Badge tone={outcomeTone(attempt.outcome)}>
                  {attempt.outcome === "PENDING" ? "Awaiting customer" : attempt.outcome}
                </Badge>
              </div>
              <div className="mt-3">
                <ConfidenceMeter value={attempt.confidence} />
              </div>
            </Field>
          ) : (
            <Field label="Strategy">
              <p className="text-[13px] text-muted">Deciding.</p>
            </Field>
          )}
        </section>

        <section className="space-y-4">
          {attempt ? (
            <>
              <Field label="Reasoning">
                <ReasoningBlock>{attempt.reasoning}</ReasoningBlock>
              </Field>
              <Field label="Nudge">
                <MessageBubble
                  channel={attempt.channel}
                  message={attempt.message}
                  link={attempt.paymentLinkUrl}
                  to={txn.customer?.phone}
                  sentAt={attempt.sentAt ? timeOfDay(attempt.sentAt) : "queued"}
                />
              </Field>
            </>
          ) : (
            <p className="text-[13px] text-muted">No attempt yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] uppercase tracking-[0.04em] text-subtle">{label}</p>
      {children}
    </div>
  );
}
