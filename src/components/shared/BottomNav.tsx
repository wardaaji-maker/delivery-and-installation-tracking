"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Profile } from "@/lib/types";
import { ADMIN_LINKS, DRIVER_LINKS } from "@/lib/navLinks";
import { cn } from "@/lib/utils";

export function BottomNav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const links = profile.role === "admin" ? ADMIN_LINKS : DRIVER_LINKS;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 flex sm:hidden border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition",
              active ? "text-blue-600" : "text-slate-500"
            )}
          >
            <Icon className="h-5 w-5" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
