import { notFound, redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LocationStatusBadge } from "@/components/shared/StatusBadge";
import { WhatsAppButton } from "@/components/shared/WhatsAppButton";
import { NavigateButton } from "@/components/shared/NavigateButton";
import { PhotoReportForm } from "@/components/driver/PhotoReportForm";
import { formatDateTime } from "@/lib/utils";
import type { Location, PhotoReport } from "@/lib/types";

export default async function DriverLocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: location } = await supabase
    .from("locations")
    .select("*")
    .eq("id", id)
    .single();

  if (!location) notFound();
  if ((location as Location).assigned_driver_id !== user?.id) redirect("/driver/locations");

  const { data: reports } = await supabase
    .from("photo_reports")
    .select("*")
    .eq("location_id", id)
    .order("submitted_at", { ascending: false });

  const loc = location as Location;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold text-slate-900">{loc.label}</h1>
          <LocationStatusBadge status={loc.status} />
        </div>
        <div className="flex items-start gap-1.5 text-sm text-slate-600">
          <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
          <span>{loc.address}</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1 text-sm">
        <p>
          <span className="text-slate-500">Receiver:</span>{" "}
          <span className="text-slate-900">{loc.receiver_name ?? "-"}</span>
        </p>
        {loc.notes && (
          <p>
            <span className="text-slate-500">Notes:</span>{" "}
            <span className="text-slate-900">{loc.notes}</span>
          </p>
        )}
        <div className="pt-2 flex flex-wrap gap-2">
          <NavigateButton lat={loc.lat} lng={loc.lng} address={loc.address} />
          {loc.receiver_phone && (
            <WhatsAppButton
              phone={loc.receiver_phone}
              label="Message receiver on WhatsApp"
              message={`Hi ${loc.receiver_name ?? ""}, this is regarding your delivery/installation at ${loc.address}.`}
            />
          )}
        </div>
      </div>

      <PhotoReportForm locationId={id} />

      {reports && reports.length > 0 && (
        <div>
          <h3 className="font-semibold text-slate-900 mb-3">Submitted reports</h3>
          <div className="space-y-4">
            {(reports as PhotoReport[]).map((report) => (
              <div key={report.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs text-slate-400 mb-2">{formatDateTime(report.submitted_at)}</p>
                {report.notes && <p className="text-sm text-slate-700 mb-3">{report.notes}</p>}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {report.photo_urls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt="Report photo"
                        className="aspect-square w-full rounded-lg object-cover border border-slate-200"
                      />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
