"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/primitives";

const NAV = [
  {
    href: "/",
    label: "Overview",
    icon: (
      <>
        <path d="M4.5 19.5V13M9.5 19.5V7M14.5 19.5v-8M19.5 19.5V4.5" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: "/feed",
    label: "Feed",
    icon: (
      <>
        <path d="M3.5 12h3.2l2.1-5.5 3.4 11L14.6 12h5.9" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    href: "/recoveries",
    label: "Recoveries",
    icon: (
      <>
        <path d="M4 6.5h16M4 12h16M4 17.5h16" strokeLinecap="round" />
      </>
    ),
  },
  {
    href: "/insights",
    label: "Insights",
    icon: (
      <>
        <path d="M3.5 15.5 9 10l3.5 3.5L20.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.5 5.5h5v5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [light, setLight] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.classList.toggle("light", light);
  }, [light]);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-bg">
      {mobileOpen ? (
        <div
          className="animate-fade-in fixed inset-0 z-30 bg-navy-deep/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <Sidebar pathname={pathname} mobileOpen={mobileOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          light={light}
          onToggleTheme={() => setLight((v) => !v)}
          onToggleNav={() => setMobileOpen((v) => !v)}
        />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ pathname, mobileOpen }: { pathname: string; mobileOpen: boolean }) {
  return (
    <aside
      className={cx(
        "fixed inset-y-0 left-0 z-40 w-[232px] shrink-0 flex-col border-r border-line bg-surface transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:flex lg:h-screen lg:translate-x-0",
        mobileOpen ? "flex translate-x-0" : "flex -translate-x-full",
      )}
    >
      <div className="border-b border-line px-6 py-5">
        <span className="block text-[15px] leading-none tracking-[-0.01em] text-ink">
          <span className="font-semibold">Recovery</span>{" "}
          <span className="font-normal text-muted">Agent</span>
        </span>
        <span className="mt-2 block text-[10px] font-medium uppercase tracking-[0.14em] text-subtle">
          Razorpay
        </span>
      </div>

      <nav className="flex-1 px-3 py-4" aria-label="Primary">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-[6px] px-3 py-2 transition-colors duration-150",
                active ? "bg-surface2 text-ink" : "text-muted hover:text-ink",
              )}
            >
              <svg
                viewBox="0 0 24 24"
                className={cx("size-[18px] shrink-0", active ? "text-rzp" : "text-subtle")}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                {item.icon}
              </svg>
              <span className="text-[13.5px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function Topbar({
  light,
  onToggleTheme,
  onToggleNav,
}: {
  light: boolean;
  onToggleTheme: () => void;
  onToggleNav: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-3 px-6 sm:px-8">
        <button
          onClick={onToggleNav}
          aria-label="Toggle navigation"
          className="-ml-2 rounded-[6px] p-2 text-muted transition-colors duration-150 hover:text-ink lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>

        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-medium text-ink">Urban Bazaar</span>
          <span className="hidden rounded-[4px] border border-line px-1.5 py-[1px] text-[10px] font-medium uppercase tracking-[0.08em] text-subtle sm:inline">
            Test
          </span>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <span className="hidden items-center gap-2 sm:inline-flex">
            <span className="size-1.5 rounded-full bg-success" />
            <span className="text-[12px] text-muted">Live</span>
          </span>
          <button
            onClick={onToggleTheme}
            aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
            className="rounded-[6px] p-1.5 text-subtle transition-colors duration-150 hover:text-ink"
          >
            {light ? (
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 14.5A8 8 0 0 1 9.5 4a8.2 8.2 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.1 5.1l1.4 1.4M17.5 17.5l1.4 1.4M18.9 5.1l-1.4 1.4M6.5 17.5l-1.4 1.4" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
