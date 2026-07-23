import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, FolderKanban, Images, MapPin, Navigation, Camera } from "lucide-react";

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const ADMIN_LINKS: NavLink[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/gallery", label: "Gallery", icon: Images },
];

export const DRIVER_LINKS: NavLink[] = [
  { href: "/driver/locations", label: "Locations", icon: MapPin },
  { href: "/driver/map", label: "Route Map", icon: Navigation },
  { href: "/driver/gallery", label: "Reports", icon: Camera },
];
