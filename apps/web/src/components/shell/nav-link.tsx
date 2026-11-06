"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, children, exact = false }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium text-muted hover:text-ink", active && "bg-line/40 text-ink")}
    >
      {children}
    </Link>
  );
}
