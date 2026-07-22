import type { LocationStatus, ProjectStatus } from "@/lib/types";
import {
  locationStatusLabels,
  locationStatusStyles,
  projectStatusStyles,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

export function LocationStatusBadge({ status }: { status: LocationStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        locationStatusStyles[status]
      )}
    >
      {locationStatusLabels[status]}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        projectStatusStyles[status]
      )}
    >
      {status}
    </span>
  );
}
