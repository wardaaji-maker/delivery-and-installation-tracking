import { createClient } from "@/lib/supabase/server";
import { PhotoGallery, type GalleryItem } from "@/components/shared/PhotoGallery";

interface ReportRow {
  id: string;
  notes: string | null;
  photo_urls: string[];
  submitted_at: string;
  location: { label: string } | null;
}

export default async function DriverGalleryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: reports } = await supabase
    .from("photo_reports")
    .select("id, notes, photo_urls, submitted_at, location:locations(label)")
    .eq("driver_id", user?.id ?? "")
    .order("submitted_at", { ascending: false });

  const rows = (reports as unknown as ReportRow[] | null) ?? [];

  const items: GalleryItem[] = rows.flatMap((r) =>
    r.photo_urls.map((url) => ({
      url,
      locationLabel: r.location?.label ?? "Unknown location",
      submittedAt: r.submitted_at,
      notes: r.notes,
    }))
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">My reports</h1>
        <p className="text-slate-500 text-sm">Photos you&apos;ve submitted</p>
      </div>
      <PhotoGallery items={items} />
    </div>
  );
}
