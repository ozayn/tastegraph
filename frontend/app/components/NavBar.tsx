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
      className="sticky top-0 z-10 border-b border-[var(--section-border)] bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-x-1 gap-y-2 px-4 py-3 sm:px-8 md:max-w-3xl md:px-10 lg:max-w-4xl lg:px-12">
        <Link
          href="/"
          className="mr-2 shrink-0 sm:mr-4"
          aria-label="TasteGraph home"
        >
          <img
            src="/logo-horizontal.svg"
            alt=""
            className="h-6 w-auto sm:h-8"
          />
        </Link>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
          {tabs.map(({ href, label }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`shrink-0 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-4 sm:text-[14px] ${
                  isActive
                    ? "bg-[var(--section-bg)] text-[var(--foreground)]"
                    : "text-[var(--muted-soft)] hover:bg-[var(--section-bg)]/50 hover:text-[var(--foreground)]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <div className="shrink-0 self-center">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
