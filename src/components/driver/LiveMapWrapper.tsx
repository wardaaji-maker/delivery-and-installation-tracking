"use client";

import dynamic from "next/dynamic";
import type { Location } from "@/lib/types";

const LiveMap = dynamic(() => import("./LiveMap").then((m) => m.LiveMap), {
  ssr: false,
  loading: () => (
    <div className="h-[70vh] w-full rounded-xl border border-slate-200 bg-slate-100 animate-pulse flex items-center justify-center text-slate-400 text-sm">
      Loading map...
    </div>
  ),
});

export function LiveMapWrapper({ locations, driverId }: { locations: Location[]; driverId: string }) {
  return <LiveMap locations={locations} driverId={driverId} />;
}
