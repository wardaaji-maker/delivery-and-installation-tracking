import Link from "next/link";
import { Plus, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ProjectStatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import type { Project } from "@/lib/types";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: locationCounts } = await supabase
    .from("locations")
    .select("project_id, status");

  const countsByProject = new Map<string, { total: number; completed: number }>();
  for (const loc of locationCounts ?? []) {
    const entry = countsByProject.get(loc.project_id) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (loc.status === "completed") entry.completed += 1;
    countsByProject.set(loc.project_id, entry);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
          <p className="text-slate-500 text-sm">Delivery &amp; installation projects</p>
        </div>
        <Link
          href="/admin/projects/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </div>

      {(!projects || projects.length === 0) && (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center">
          <p className="text-slate-500">No projects yet.</p>
          <Link href="/admin/projects/new" className="text-blue-600 font-medium hover:underline text-sm">
            Create your first project
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(projects as Project[] | null)?.map((project) => {
          const counts = countsByProject.get(project.id) ?? { total: 0, completed: 0 };
          const pct = counts.total ? Math.round((counts.completed / counts.total) * 100) : 0;
          return (
            <Link
              key={project.id}
              href={`/admin/projects/${project.id}`}
              className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-blue-200 transition"
            >
              <div className="flex items-start justify-between mb-2">
                <h2 className="font-semibold text-slate-900">{project.name}</h2>
                <ProjectStatusBadge status={project.status} />
              </div>
              {project.description && (
                <p className="text-sm text-slate-500 line-clamp-2 mb-3">{project.description}</p>
              )}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                <MapPin className="h-3.5 w-3.5" />
                {counts.total} location{counts.total === 1 ? "" : "s"}
                {counts.total > 0 && ` · ${pct}% complete`}
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-3">Due {formatDate(project.due_date)}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
