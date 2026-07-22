import Link from "next/link";
import { Truck } from "lucide-react";
import type { Profile } from "@/lib/types";
import { SignOutButton } from "./SignOutButton";

const ADMIN_LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/gallery", label: "Gallery" },
];

const DRIVER_LINKS = [
  { href: "/driver/locations", label: "My Locations" },
  { href: "/driver/map", label: "Route Map" },
  { href: "/driver/gallery", label: "My Reports" },
];

export function Navbar({ profile }: { profile: Profile }) {
  const links = profile.role === "admin" ? ADMIN_LINKS : DRIVER_LINKS;
  const homeHref = profile.role === "admin" ? "/admin/dashboard" : "/driver/locations";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href={homeHref} className="flex items-center gap-2 font-semibold text-slate-900">
            <Truck className="h-5 w-5 text-blue-600" />
            TrackFlow
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-900">{profile.full_name}</p>
            <p className="text-xs text-slate-500 capitalize">{profile.role}</p>
          </div>
          <SignOutButton />
        </div>
      </div>
      <nav className="flex sm:hidden items-center gap-1 px-4 pb-2 overflow-x-auto">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
