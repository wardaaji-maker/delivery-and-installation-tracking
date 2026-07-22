import { createClient } from "@/lib/supabase/server";
import { LocationCard } from "@/components/driver/LocationCard";
import type { Location, Project } from "@/lib/types";

export default async function DriverLocationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: locations } = await supabase
    .from("locations")
    .select("*")
    .eq("assigned_driver_id", user?.id ?? "")
    .order("created_at", { ascending: false });

  const projectIds = [...new Set((locations ?? []).map((l) => l.project_id))];
  const { data: projects } = projectIds.length
    ? await supabase.from("projects").select("id, name").in("id", projectIds)
    : { data: [] as Pick<Project, "id" | "name">[] };

  const projectNameById = new Map((projects ?? []).map((p) => [p.id, p.name]));

  const list = (locations as Location[] | null) ?? [];
  const active = list.filter((l) => l.status !== "completed");
  const done = list.filter((l) => l.status === "completed");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My locations</h1>
        <p className="text-slate-500 text-sm">Deliveries and installations assigned to you</p>
      </div>

      {list.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-500">
          No locations assigned to you yet.
        </div>
      )}

      {active.length > 0 && (
        <div>
          <h2 className="font-medium text-slate-700 mb-3">To do ({active.length})</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((loc) => (
              <LocationCard key={loc.id} location={loc} projectName={projectNameById.get(loc.project_id)} />
            ))}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div>
          <h2 className="font-medium text-slate-700 mb-3">Completed ({done.length})</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {done.map((loc) => (
              <LocationCard key={loc.id} location={loc} projectName={projectNameById.get(loc.project_id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
