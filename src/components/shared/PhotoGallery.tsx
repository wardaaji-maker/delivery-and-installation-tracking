"use client";

import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import toast from "react-hot-toast";
import { formatDateTime } from "@/lib/utils";

export interface GalleryItem {
  url: string;
  locationLabel: string;
  driverName?: string;
  submittedAt: string;
  notes?: string | null;
}

function filenameFor(item: GalleryItem) {
  const urlName = item.url.split("/").pop()?.split("?")[0] ?? "photo.jpg";
  const slug = item.locationLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `${slug || "report"}-${urlName}`;
}

async function downloadImage(item: GalleryItem) {
  try {
    const response = await fetch(item.url);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filenameFor(item);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    toast.error("Couldn't download photo, opening it in a new tab instead");
    window.open(item.url, "_blank");
  }
}

export function PhotoGallery({ items }: { items: GalleryItem[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-500 text-sm">
        No photo reports submitted yet.
      </div>
    );
  }

  const active = activeIndex != null ? items[activeIndex] : null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item, i) => (
          <div key={`${item.url}-${i}`} className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200">
            <button onClick={() => setActiveIndex(i)} className="block h-full w-full">
              <img
                src={item.url}
                alt={item.locationLabel}
                className="h-full w-full object-cover group-hover:scale-105 transition"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <p className="text-white text-xs font-medium truncate pr-6">{item.locationLabel}</p>
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadImage(item);
              }}
              title="Download photo"
              className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1.5 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 transition"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setActiveIndex(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadImage(active);
              }}
              title="Download photo"
              className="text-white/80 hover:text-white"
            >
              <Download className="h-6 w-6" />
            </button>
            <button
              onClick={() => setActiveIndex(null)}
              className="text-white/80 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {activeIndex! > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((i) => (i != null ? i - 1 : i));
              }}
              className="absolute left-4 text-white/80 hover:text-white"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}
          {activeIndex! < items.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((i) => (i != null ? i + 1 : i));
              }}
              className="absolute right-4 text-white/80 hover:text-white"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}

          <div className="max-w-3xl max-h-[85vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img src={active.url} alt={active.locationLabel} className="max-h-[70vh] rounded-lg object-contain" />
            <div className="text-white text-center mt-3">
              <p className="font-medium">{active.locationLabel}</p>
              <p className="text-sm text-white/70">
                {active.driverName && `${active.driverName} · `}
                {formatDateTime(active.submittedAt)}
              </p>
              {active.notes && <p className="text-sm text-white/80 mt-1 max-w-md">{active.notes}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
