import { createClient } from "@/lib/supabase/server";
import { PhotoGallery, type GalleryItem } from "@/components/shared/PhotoGallery";
import { ProjectFilterSelect } from "@/components/shared/ProjectFilterSelect";

interface ReportRow {
  id: string;
  notes: string | null;
  photo_urls: string[];
  submitted_at: string;
  location: { label: string; project_id: string } | null;
  driver: { full_name: string } | null;
}

export default async function AdminGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectFilter } = await searchParams;
  const supabase = await createClient();

  const { data: projects } = await supabase.from("projects").select("id, name").order("name");

  const { data: reports } = await supabase
    .from("photo_reports")
    .select("id, notes, photo_urls, submitted_at, location:locations(label, project_id), driver:profiles(full_name)")
    .order("submitted_at", { ascending: false });

  let rows = (reports as unknown as ReportRow[] | null) ?? [];
  if (projectFilter) {
    rows = rows.filter((r) => r.location?.project_id === projectFilter);
  }

  const items: GalleryItem[] = rows.flatMap((r) =>
    r.photo_urls.map((url) => ({
      url,
      locationLabel: r.location?.label ?? "Unknown location",
      driverName: r.driver?.full_name,
      submittedAt: r.submitted_at,
      notes: r.notes,
    }))
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Photo gallery</h1>
          <p className="text-slate-500 text-sm">All submitted installation/delivery reports</p>
        </div>
        <ProjectFilterSelect projects={projects ?? []} value={projectFilter ?? ""} />
      </div>

      <PhotoGallery items={items} />
    </div>
  );
}
