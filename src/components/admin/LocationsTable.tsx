"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { LocationStatusBadge } from "@/components/shared/StatusBadge";
import { WhatsAppButton } from "@/components/shared/WhatsAppButton";
import type { Location, Profile } from "@/lib/types";

export function LocationsTable({
  locations,
  drivers,
}: {
  locations: Location[];
  drivers: Profile[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [updating, setUpdating] = useState<string | null>(null);

  async function assignDriver(locationId: string, driverId: string) {
    setUpdating(locationId);

    const { error } = await supabase
      .from("locations")
      .update({
        assigned_driver_id: driverId || null,
        status: driverId ? "assigned" : "unassigned",
      })
      .eq("id", locationId);

    setUpdating(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    router.refresh();
  }

  async function deleteLocation(locationId: string) {
    if (!confirm("Remove this location?")) return;
    const { error } = await supabase.from("locations").delete().eq("id", locationId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Location removed");
    router.refresh();
  }

  if (locations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-500 text-sm">
        No locations yet. Add one manually or import a CSV/Excel file above.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Location</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Receiver</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Assigned driver</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
            <th className="text-left px-4 py-3 font-medium text-slate-600"></th>
          </tr>
        </thead>
        <tbody>
          {locations.map((loc) => (
            <tr key={loc.id} className="border-t border-slate-100">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900">{loc.label}</p>
                <p className="text-xs text-slate-500">{loc.address}</p>
              </td>
              <td className="px-4 py-3">
                <p className="text-slate-700">{loc.receiver_name ?? "-"}</p>
                {loc.receiver_phone && (
                  <WhatsAppButton
                    phone={loc.receiver_phone}
                    message={`Hi ${loc.receiver_name ?? ""}, this is regarding your delivery for "${loc.label}".`}
                    className="mt-1"
                  />
                )}
              </td>
              <td className="px-4 py-3">
                <select
                  value={loc.assigned_driver_id ?? ""}
                  disabled={updating === loc.id}
                  onChange={(e) => assignDriver(loc.id, e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                >
                  <option value="">Unassigned</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <LocationStatusBadge status={loc.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => deleteLocation(loc.id)}
                  className="text-slate-400 hover:text-red-600 transition"
                  title="Remove location"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
