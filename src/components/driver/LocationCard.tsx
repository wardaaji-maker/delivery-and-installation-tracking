"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Camera } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { LocationStatusBadge } from "@/components/shared/StatusBadge";
import { WhatsAppButton } from "@/components/shared/WhatsAppButton";
import { NavigateButton } from "@/components/shared/NavigateButton";
import type { Location, LocationStatus } from "@/lib/types";

const NEXT_STATUS: Partial<Record<LocationStatus, LocationStatus>> = {
  assigned: "in_progress",
};

export function LocationCard({ location, projectName }: { location: Location; projectName?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [updating, setUpdating] = useState(false);

  const nextStatus = NEXT_STATUS[location.status];

  async function startJob() {
    if (!nextStatus) return;
    setUpdating(true);
    const { error } = await supabase
      .from("locations")
      .update({ status: nextStatus })
      .eq("id", location.id);
    setUpdating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-slate-900">{location.label}</p>
          {projectName && <p className="text-xs text-slate-400">{projectName}</p>}
        </div>
        <LocationStatusBadge status={location.status} />
      </div>

      <div className="flex items-start gap-1.5 text-sm text-slate-600 mb-2">
        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
        <span>{location.address}</span>
      </div>

      {location.receiver_name && (
        <p className="text-sm text-slate-600 mb-3">Receiver: {location.receiver_name}</p>
      )}

      {location.notes && <p className="text-sm text-slate-500 mb-3">{location.notes}</p>}

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <NavigateButton lat={location.lat} lng={location.lng} address={location.address} />
        <WhatsAppButton
          phone={location.receiver_phone}
          label="Contact receiver"
          message={`Hi ${location.receiver_name ?? ""}, I'm on my way for the delivery/installation at ${location.address}.`}
        />
        {nextStatus && (
          <button
            onClick={startJob}
            disabled={updating}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition disabled:opacity-60"
          >
            {updating ? "Updating..." : "Start job"}
          </button>
        )}
        <Link
          href={`/driver/locations/${location.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition"
        >
          <Camera className="h-3.5 w-3.5" />
          {location.status === "completed" ? "View report" : "Submit report"}
        </Link>
      </div>
    </div>
  );
}
