"use client";

import * as React from "react";
import { useCountUp } from "@/components/lib/usePoll";
import { Skeleton } from "@/components/ui/primitives";

export function KpiCard({
  label,
  value,
  format,
  meta,
  loading,
}: {
  label: string;
  value: number;
  /** Renders the animated value; receives the in-flight count-up number. */
  format: (n: number) => string;
  /** Short numeric qualifier, e.g. "412 of 1,000". */
  meta?: string;
  loading?: boolean;
}) {
  const [hasLoaded, setHasLoaded] = React.useState(!loading);
  React.useEffect(() => {
    if (!loading) setHasLoaded(true);
  }, [loading]);
  const animated = useCountUp(value);

  return (
    <div className="rounded-[8px] border border-line bg-surface px-5 py-4">
      <p className="text-[11px] uppercase tracking-[0.04em] text-subtle">{label}</p>
      {loading && !hasLoaded ? (
        <Skeleton className="mt-3.5 h-8 w-28" />
      ) : (
        <p className="tnum mt-3 text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink">
          {format(animated)}
        </p>
      )}
      <p className="tnum mt-2.5 text-[12px] text-subtle">{meta ?? " "}</p>
    </div>
  );
}
