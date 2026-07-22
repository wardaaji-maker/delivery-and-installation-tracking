import { createClient } from "@/lib/supabase/server";
import { LiveMapWrapper } from "@/components/driver/LiveMapWrapper";
import type { Location } from "@/lib/types";

export default async function DriverMapPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: locations } = await supabase
    .from("locations")
    .select("*")
    .eq("assigned_driver_id", user?.id ?? "")
    .neq("status", "completed");

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Route map</h1>
        <p className="text-slate-500 text-sm">
          Live location sharing is on while this page is open. Tap a pin for details.
        </p>
      </div>
      <LiveMapWrapper locations={(locations as Location[] | null) ?? []} driverId={user!.id} />
    </div>
  );
}
