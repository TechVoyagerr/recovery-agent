"use client";

import * as React from "react";
import type { Channel } from "@/lib/types";
import { channelLabel } from "@/components/lib/format";

/** Renders the outgoing nudge the way the customer will actually see it. */
export function MessageBubble({
  channel,
  message,
  link,
  to,
  sentAt,
}: {
  channel: Channel | string;
  message: string;
  link?: string | null;
  to?: string;
  sentAt?: string;
}) {
  if (channel === "none") {
    return <p className="text-[13px] text-muted">No message sent.</p>;
  }

  return (
    <div className="rounded-[6px] border border-line bg-surface2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.04em] text-subtle">
          <ChannelIcon channel={channel} />
          {channelLabel(channel)}
          {to ? <span className="font-mono normal-case tracking-normal">· {to}</span> : null}
        </span>
        {sentAt ? <span className="text-[11px] text-subtle">{sentAt}</span> : null}
      </div>

      <p className="text-[13px] leading-[1.55] whitespace-pre-wrap break-words text-ink">
        {message}
      </p>

      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block truncate font-mono text-[11.5px] text-rzp-bright underline-offset-2 hover:underline"
        >
          {link}
        </a>
      ) : null}
    </div>
  );
}

export function ChannelIcon({ channel }: { channel: string }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "size-[14px] text-subtle",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
  } as const;

  if (channel === "email") {
    return (
      <svg {...common}>
        <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
        <path d="m4 7 8 5.5L20 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (channel === "none") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="m6.5 17.5 11-11" strokeLinecap="round" />
      </svg>
    );
  }
  if (channel === "whatsapp") {
    return (
      <svg {...common}>
        <path
          d="M4 12a8 8 0 1 1 3.4 6.5L3.5 20l1.2-3.6A7.9 7.9 0 0 1 4 12Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path
        d="M4 6.5A2 2 0 0 1 6 4.5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-5 4V6.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
