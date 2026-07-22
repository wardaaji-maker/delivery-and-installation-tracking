import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectStatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";
import { BulkLocationImport } from "@/components/admin/BulkLocationImport";
import { AddLocationForm } from "@/components/admin/AddLocationForm";
import { LocationsTable } from "@/components/admin/LocationsTable";
import type { Location, Profile, Project } from "@/lib/types";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) notFound();

  const { data: locations } = await supabase
    .from("locations")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const { data: drivers } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "driver")
    .order("full_name");

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold text-slate-900">{(project as Project).name}</h1>
          <ProjectStatusBadge status={(project as Project).status} />
        </div>
        {(project as Project).description && (
          <p className="text-slate-600 mb-1">{(project as Project).description}</p>
        )}
        <p className="text-sm text-slate-500">Due {formatDate((project as Project).due_date)}</p>
      </div>

      <BulkLocationImport projectId={id} />
      <AddLocationForm projectId={id} />

      <div>
        <h2 className="font-semibold text-slate-900 mb-3">
          Locations ({locations?.length ?? 0})
        </h2>
        <LocationsTable
          locations={(locations as Location[] | null) ?? []}
          drivers={(drivers as Profile[] | null) ?? []}
        />
      </div>
    </div>
  );
}
