"use client";

import dynamic from "next/dynamic";
import type { DriverPosition, Location, Profile } from "@/lib/types";

const AdminLiveMap = dynamic(() => import("./AdminLiveMap").then((m) => m.AdminLiveMap), {
  ssr: false,
  loading: () => (
    <div className="h-[60vh] w-full rounded-xl border border-slate-200 bg-slate-100 animate-pulse flex items-center justify-center text-slate-400 text-sm">
      Loading map...
    </div>
  ),
});

export function AdminLiveMapWrapper(props: {
  locations: Location[];
  drivers: Profile[];
  initialPositions: DriverPosition[];
}) {
  return <AdminLiveMap {...props} />;
}
