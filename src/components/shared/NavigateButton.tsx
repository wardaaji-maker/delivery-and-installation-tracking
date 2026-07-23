import { Navigation } from "lucide-react";
import { navigationLink, cn } from "@/lib/utils";

export function NavigateButton({
  lat,
  lng,
  address,
  className,
}: {
  lat: number | null;
  lng: number | null;
  address?: string | null;
  className?: string;
}) {
  const href = navigationLink(lat, lng, address);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition",
        className
      )}
    >
      <Navigation className="h-3.5 w-3.5" />
      Navigate
    </a>
  );
}
