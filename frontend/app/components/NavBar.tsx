"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const tabs = [
  { href: "/", label: "Home" },
  { href: "/insights", label: "Insights" },
  { href: "/studies", label: "Studies" },
  { href: "/learn", label: "Learn" },
  { href: "/model-lab", label: "Model Lab" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-10 border-b border-[var(--card-border)] bg-[var(--card-bg)]"
      aria-label="Main navigation"
    >
      <div className="tg-main grid grid-cols-[1fr_auto] grid-rows-[auto_auto] gap-x-2 gap-y-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-rows-1 sm:items-center sm:gap-x-3 sm:py-3.5">
        <Link
          href="/"
          className="col-start-1 row-start-1 shrink-0 self-center"
          aria-label="TasteGraph home"
        >
          <img
            src="/logo-horizontal.svg"
            alt=""
            className="h-6 w-auto sm:h-7"
          />
        </Link>

        <div className="col-span-2 col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-x-0.5 gap-y-1 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:justify-center">
          {tabs.map(({ href, label }) => {
            const isActive =
              pathname === href ||
              (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`shrink-0 rounded-md px-2.5 py-2 text-[13px] font-medium leading-none transition-colors sm:px-3 sm:py-2 sm:text-[14px] ${
                  isActive
                    ? "bg-[var(--section-bg)] text-[var(--foreground)] ring-1 ring-[var(--section-border)]"
                    : "text-[var(--muted)] hover:bg-[var(--section-bg)] hover:text-[var(--foreground)]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="col-start-2 row-start-1 justify-self-end self-center sm:col-start-3">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
