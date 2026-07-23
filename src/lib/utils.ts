import type { LocationStatus, ProjectStatus } from "./types";

/** Normalizes a phone number and builds a wa.me click-to-chat link. */
export function whatsappLink(phone: string, message?: string) {
  const digits = phone.replace(/[^\d]/g, "").replace(/^0/, "62"); // default to ID country code
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Builds a Google Maps turn-by-turn directions link — opens the native app on mobile. */
export function navigationLink(
  lat: number | null,
  lng: number | null,
  address?: string | null
): string | null {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
  }
  return null;
}

export function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const locationStatusStyles: Record<LocationStatus, string> = {
  unassigned: "bg-gray-100 text-gray-700",
  assigned: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export const locationStatusLabels: Record<LocationStatus, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  in_progress: "In Progress",
  completed: "Completed",
  failed: "Failed",
};

export const projectStatusStyles: Record<ProjectStatus, string> = {
  planning: "bg-gray-100 text-gray-700",
  active: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
