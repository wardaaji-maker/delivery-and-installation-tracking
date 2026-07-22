"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";

export function PhotoReportForm({ locationId }: { locationId: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    setFiles((prev) => [...prev, ...Array.from(fileList)]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) {
      toast.error("Add at least one photo");
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSubmitting(false);
      toast.error("Not signed in");
      return;
    }

    try {
      const urls: string[] = [];
      for (const file of files) {
        const path = `${user.id}/${locationId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("photo-reports")
          .upload(path, file);
        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabase.storage.from("photo-reports").getPublicUrl(path);
        urls.push(publicUrl.publicUrl);
      }

      const { error: reportError } = await supabase.from("photo_reports").insert({
        location_id: locationId,
        driver_id: user.id,
        notes: notes || null,
        photo_urls: urls,
      });
      if (reportError) throw reportError;

      const { error: locationError } = await supabase
        .from("locations")
        .update({ status: "completed" })
        .eq("id", locationId);
      if (locationError) throw locationError;

      toast.success("Report submitted");
      setFiles([]);
      setNotes("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <h3 className="font-semibold text-slate-900">Submit installation/delivery report</h3>

      <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition">
        <ImagePlus className="h-6 w-6 text-slate-400" />
        <span className="text-sm text-slate-500">Tap to add photos (you can select several)</span>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {files.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {files.map((file, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Installation notes, issues, condition on arrival..."
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? "Uploading..." : "Submit report & mark complete"}
      </button>
    </form>
  );
}
