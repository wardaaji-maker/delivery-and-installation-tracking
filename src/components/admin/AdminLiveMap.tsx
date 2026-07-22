"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { createClient } from "@/lib/supabase/client";
import { locationStatusLabels } from "@/lib/utils";
import type { DriverPosition, Location, Profile } from "@/lib/types";

function locationIcon(status: Location["status"]) {
  const color =
    status === "completed" ? "#16a34a" : status === "in_progress" ? "#f59e0b" : "#64748b";
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:14px;height:14px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 14],
  });
}

const driverIcon = L.divIcon({
  className: "",
  html: `<div style="background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #2563eb"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 12);
    else map.fitBounds(points, { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points.map((p) => p.join(",")).join("|")]);
  return null;
}

export function AdminLiveMap({
  locations,
  drivers,
  initialPositions,
}: {
  locations: Location[];
  drivers: Profile[];
  initialPositions: DriverPosition[];
}) {
  const supabase = createClient();
  const [latestByDriver, setLatestByDriver] = useState(() => {
    const map = new Map<string, DriverPosition>();
    for (const pos of initialPositions) {
      const existing = map.get(pos.driver_id);
      if (!existing || new Date(pos.recorded_at) > new Date(existing.recorded_at)) {
        map.set(pos.driver_id, pos);
      }
    }
    return map;
  });

  useEffect(() => {
    const channel = supabase
      .channel("driver_positions_dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "driver_positions" },
        (payload) => {
          const pos = payload.new as DriverPosition;
          setLatestByDriver((prev) => {
            const next = new Map(prev);
            next.set(pos.driver_id, pos);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const driverNameById = new Map(drivers.map((d) => [d.id, d.full_name]));

  const locationPoints = locations
    .filter((l) => l.lat != null && l.lng != null)
    .map((l) => [l.lat as number, l.lng as number] as [number, number]);
  const driverPoints = [...latestByDriver.values()].map((p) => [p.lat, p.lng] as [number, number]);
  const boundsPoints = [...locationPoints, ...driverPoints];

  return (
    <div className="h-[60vh] w-full rounded-xl overflow-hidden border border-slate-200">
      <MapContainer center={locationPoints[0] ?? [-6.2, 106.8]} zoom={11} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={boundsPoints} />

        {locations
          .filter((l) => l.lat != null && l.lng != null)
          .map((loc) => (
            <Marker key={loc.id} position={[loc.lat as number, loc.lng as number]} icon={locationIcon(loc.status)}>
              <Popup>
                <p className="font-medium">{loc.label}</p>
                <p className="text-xs text-slate-500">{loc.address}</p>
                <p className="text-xs mt-1">{locationStatusLabels[loc.status]}</p>
              </Popup>
            </Marker>
          ))}

        {[...latestByDriver.entries()].map(([driverId, pos]) => (
          <Marker key={driverId} position={[pos.lat, pos.lng]} icon={driverIcon}>
            <Popup>
              <p className="font-medium">{driverNameById.get(driverId) ?? "Driver"}</p>
              <p className="text-xs text-slate-500">
                Updated {new Date(pos.recorded_at).toLocaleTimeString()}
              </p>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
