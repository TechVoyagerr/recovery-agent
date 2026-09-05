import { db } from "./db";
import { REASONS, Stats } from "./types";
export async function getStats(): Promise<Stats> {
  const txs = await db.transaction.findMany({ include: { attempts: true } });
  const failures = txs.filter((t) => t.failureReason !== "NONE");
  const isAttributed = (a: (typeof failures)[number]["attempts"][number]) =>
    a.outcome === "RECOVERED" && !!a.sentAt && !!a.paymentLinkId &&
    ["PAYMENT_LINK", "SIMULATED_LINK"].includes(a.attribution ?? "");
  const isRecovered = (t: (typeof failures)[number]) =>
    t.status === "RECOVERED" && t.attempts.some(isAttributed);
  const recovered = failures.filter(isRecovered);
  const attempts = failures
    .flatMap((t) => t.attempts)
    .filter((a) => a.channel !== "none");
  const sent = attempts.filter((a) => a.sentAt);
  const timeline = new Map<
    string,
    {
      bucket: string;
      failed: number;
      recovered: number;
      revenueRecoveredPaise: number;
    }
  >();
  const times = failures.flatMap((t) => [
    t.createdAt.getTime(),
    ...(isRecovered(t) && t.recoveredAt ? [t.recoveredAt.getTime()] : []),
  ]);
  const first = times.reduce((a, b) => Math.min(a, b), Infinity);
  const last = times.reduce((a, b) => Math.max(a, b), -Infinity);
  const span = last - first;
  const bucketMs = span < 3 * 3600000 ? 60000 : span < 24 * 3600000 ? 15 * 60000 : 3600000;
  const bucketAt = (d: Date) => {
    const bucket = new Date(Math.floor(d.getTime() / bucketMs) * bucketMs).toISOString();
    if (!timeline.has(bucket))
      timeline.set(bucket, {
        bucket,
        failed: 0,
        recovered: 0,
        revenueRecoveredPaise: 0,
      });
    return timeline.get(bucket)!;
  };
  if (times.length) {
    const start = Math.floor(first / bucketMs) * bucketMs;
    const end = Math.max(Math.floor(last / bucketMs) * bucketMs, start + bucketMs);
    for (let time = start; time <= end; time += bucketMs) bucketAt(new Date(time));
  }
  for (const t of failures) {
    bucketAt(t.createdAt).failed++;
    if (isRecovered(t) && t.recoveredAt) {
      const b = bucketAt(t.recoveredAt);
      b.recovered++;
      b.revenueRecoveredPaise += t.amountPaise;
    }
  }
  return {
    synthetic: failures.some((t) => !!t.simulationRunId || t.isDemo),
    totalSuppressed: failures.filter((t) => t.attempts.length > 0 && t.attempts.every((a) => !a.sentAt) && t.status === "GIVEN_UP").length,
    totalFailed: failures.length,
    totalAttempted: failures.filter((t) => t.attempts.some((a) => a.sentAt))
      .length,
    recovered: recovered.length,
    recoveryRate: failures.length ? recovered.length / failures.length : 0,
    revenueAtRiskPaise: failures
      .filter((t) => !["RECOVERED", "PAID"].includes(t.status))
      .reduce((s, t) => s + t.amountPaise, 0),
    revenueRecoveredPaise: recovered.reduce((s, t) => s + t.amountPaise, 0),
    avgRecoveryMinutes: recovered.length
      ? recovered.reduce(
          (s, t) =>
            s +
            Math.max(
              0,
              ((t.recoveredAt?.getTime() ?? t.createdAt.getTime()) -
                t.createdAt.getTime()) /
                60000,
            ),
          0,
        ) / recovered.length
      : 0,
    activeRecoveries: failures.filter((t) =>
      ["FAILED", "PENDING_RECOVERY"].includes(t.status),
    ).length,
    byReason: REASONS.map((reason) => {
      const ts = failures.filter((t) => t.failureReason === reason),
        rs = ts.filter(isRecovered);
      return {
        reason,
        failed: ts.length,
        attempted: ts.filter((t) => t.attempts.some((a) => a.sentAt)).length,
        suppressed: ts.filter((t) => t.status === "GIVEN_UP" && t.attempts.length > 0 && t.attempts.every((a) => !a.sentAt)).length,
        recovered: rs.length,
        revenueRecoveredPaise: rs.reduce((s, t) => s + t.amountPaise, 0),
        rate: ts.length ? rs.length / ts.length : 0,
      };
    }),
    byChannel: ["whatsapp", "sms", "email"].map((channel) => {
      const as = sent.filter((a) => a.channel === channel);
      return {
        channel,
        attempts: as.length,
        recovered: as.filter(isAttributed).length,
        rate: as.length
          ? as.filter(isAttributed).length / as.length
          : 0,
      };
    }),
    timeline: [...timeline.values()].sort((a, b) =>
      a.bucket.localeCompare(b.bucket),
    ),
  };
}
export async function getLearning() {
  const stats = await db.learningStat.findMany({
    orderBy: [{ reason: "asc" }, { channel: "asc" }, { timingBucket: "asc" }],
  });
  const grouped = new Map<
    string,
    { reason: string; channel: string; successes: number; n: number }
  >();
  for (const s of stats) {
    const key = s.reason + ":" + s.channel;
    const v = grouped.get(key) ?? {
      reason: s.reason,
      channel: s.channel,
      successes: 0,
      n: 0,
    };
    v.successes += s.successes;
    v.n += s.successes + s.failures;
    grouped.set(key, v);
  }
  const matrix = [...grouped.values()].map((s) => ({
    reason: s.reason,
    channel: s.channel,
    rate: s.n ? s.successes / s.n : 0,
    n: s.n,
  }));
  const insights = stats
    .filter((s) => s.successes + s.failures >= 10)
    .sort(
      (a, b) =>
        b.successes / (b.successes + b.failures) -
        a.successes / (a.successes + a.failures),
    )
    .slice(0, 6)
    .map(
      (s) =>
        `${s.reason.replaceAll("_", " ").toLowerCase()} recovered ${s.successes} of ${s.successes + s.failures} attempts via ${s.channel} in the ${s.timingBucket} window (${Math.round((s.successes / (s.successes + s.failures)) * 100)}%). These are observed outcomes, not a causal guarantee.`,
    );
  if (!insights.length)
    insights.push(
      "Collect at least 10 resolved attempts per strategy before drawing an insight. Decisions currently rely on reason-specific Bayesian priors.",
    );
  return { stats, matrix, insights };
}
