import Link from "next/link";
import { FolderKanban, MapPin, CheckCircle2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatTile } from "@/components/admin/StatTile";
import { AdminLiveMapWrapper } from "@/components/admin/AdminLiveMapWrapper";
import { ProjectStatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import type { DriverPosition, Location, Profile, Project } from "@/lib/types";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [{ data: projects }, { data: locations }, { data: drivers }, { data: positions }] =
    await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("locations").select("*"),
      supabase.from("profiles").select("*").eq("role", "driver"),
      supabase
        .from("driver_positions")
        .select("*")
        .order("recorded_at", { ascending: false })
        .limit(500),
    ]);

  const allProjects = (projects as Project[] | null) ?? [];
  const allLocations = (locations as Location[] | null) ?? [];
  const allDrivers = (drivers as Profile[] | null) ?? [];
  const allPositions = (positions as DriverPosition[] | null) ?? [];

  const completedCount = allLocations.filter((l) => l.status === "completed").length;
  const completionPct = allLocations.length
    ? Math.round((completedCount / allLocations.length) * 100)
    : 0;

  const recentProjects = allProjects.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm">Live overview of deliveries and installations</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          icon={FolderKanban}
          label="Active projects"
          value={allProjects.filter((p) => p.status === "active").length}
          sublabel={`${allProjects.length} total`}
        />
        <StatTile
          icon={MapPin}
          label="Locations"
          value={allLocations.length}
          sublabel={`${allLocations.filter((l) => l.status === "unassigned").length} unassigned`}
        />
        <StatTile
          icon={CheckCircle2}
          label="Completed"
          value={`${completionPct}%`}
          sublabel={`${completedCount} of ${allLocations.length}`}
        />
        <StatTile icon={Users} label="Drivers" value={allDrivers.length} />
      </div>

      <div>
        <h2 className="font-semibold text-slate-900 mb-3">Live driver &amp; location map</h2>
        <AdminLiveMapWrapper
          locations={allLocations}
          drivers={allDrivers}
          initialPositions={allPositions}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-900">Recent projects</h2>
          <Link href="/admin/projects" className="text-sm text-blue-600 font-medium hover:underline">
            View all
          </Link>
        </div>
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Project</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Due date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentProjects.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link href={`/admin/projects/${p.id}`} className="font-medium text-slate-900 hover:text-blue-600">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(p.due_date)}</td>
                  <td className="px-4 py-3">
                    <ProjectStatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
              {recentProjects.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                    No projects yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
