"use client";

import * as React from "react";
import type { Tone } from "@/components/lib/format";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------------------------------------- Card */

export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cx("rounded-[8px] border border-line bg-surface", className)}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-4">
      <h2 className="text-[13.5px] font-semibold tracking-[-0.005em] text-ink">{title}</h2>
      {action}
    </div>
  );
}

/* ---------------------------------------------------------------- Dot */

const DOT_CLASS: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-rzp",
  neutral: "bg-line-strong",
};

const TEXT_CLASS: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-rzp-bright",
  neutral: "text-muted",
};

/** Status as a small dot plus text - never a filled pill. */
export function Badge({
  tone = "neutral",
  children,
  className,
  dot = true,
  muted,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
  /** Keeps the label in muted ink and lets only the dot carry the colour. */
  muted?: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap",
        muted ? "text-muted" : TEXT_CLASS[tone],
        className,
      )}
    >
      {dot ? <span className={cx("size-1.5 shrink-0 rounded-full", DOT_CLASS[tone])} /> : null}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- Button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "bg-rzp text-white hover:bg-rzp-bright disabled:bg-rzp/40",
  secondary: "border border-line-strong text-ink hover:bg-surface2",
  ghost: "text-muted hover:text-ink",
  danger: "border border-line-strong text-muted hover:text-danger hover:border-danger/40",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12.5px] rounded-[6px]",
  md: "h-9 px-3.5 text-[13px] rounded-[6px]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------- Confidence */

export function ConfidenceMeter({
  value,
  label = "Confidence",
}: {
  value: number;
  label?: string;
}) {
  const pctValue = Math.max(0, Math.min(100, value > 1 ? value : value * 100));
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[11px] uppercase tracking-[0.04em] text-subtle">{label}</span>
      <div className="h-[3px] w-24 overflow-hidden rounded-full bg-surface3" aria-hidden>
        <div className="h-full bg-rzp" style={{ width: `${pctValue}%` }} />
      </div>
      <span className="tnum text-[12px] text-ink">{pctValue.toFixed(0)}%</span>
    </div>
  );
}

/* -------------------------------------------------- Reasoning / state */

export function ReasoningBlock({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-l border-line-strong py-0.5 pl-3 text-[13px] leading-[1.55] text-muted">
      {children}
    </p>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-[6px]", className)} />;
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-16 text-center">
      <p className="text-[13.5px] font-medium text-ink">{title}</p>
      {detail ? <p className="max-w-xs text-[13px] text-muted">{detail}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <Badge tone="danger">Disconnected</Badge>
      <p className="text-[13px] text-muted">{message}</p>
      {onRetry ? (
        <Button size="sm" onClick={onRetry} className="mt-2">
          Retry
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ Selects */

export function Select({
  label,
  value,
  onChange,
  options,
  allLabel = "All",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[11px] uppercase tracking-[0.04em] text-subtle">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-[140px] rounded-[6px] border border-line bg-surface px-2 text-[13px] text-ink transition-colors duration-150 hover:border-line-strong"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------- Modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  width = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const focusables = ref.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => {
      ref.current?.querySelector<HTMLElement>("button, input, select")?.focus();
    }, 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="animate-fade-in fixed inset-0 bg-navy-deep/70" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "animate-fade-in relative z-10 w-full rounded-[10px] border border-line bg-surface shadow-overlay",
          width,
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="text-[14px] font-semibold tracking-[-0.005em] text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-[6px] p-1 text-subtle transition-colors duration-150 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Drawer */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="animate-fade-in absolute inset-0 bg-navy-deep/60" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-drawer-in absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col border-l border-line bg-surface shadow-overlay"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-semibold tracking-[-0.005em] text-ink">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 truncate font-mono text-[11.5px] text-subtle">{subtitle}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close details"
            className="rounded-[6px] p-1 text-subtle transition-colors duration-150 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------- Page header */

export function PageHeader({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.015em] text-ink">
        {title}
      </h1>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
