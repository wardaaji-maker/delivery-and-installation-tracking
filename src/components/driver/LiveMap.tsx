"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { createClient } from "@/lib/supabase/client";
import { locationStatusLabels } from "@/lib/utils";
import type { Location } from "@/lib/types";

const driverIcon = L.divIcon({
  className: "",
  html: `<div style="background:#2563eb;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #2563eb"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

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

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else {
      map.fitBounds(points, { padding: [40, 40] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points.map((p) => p.join(",")).join("|")]);
  return null;
}

export function LiveMap({ locations, driverId }: { locations: Location[]; driverId: string }) {
  const supabase = createClient();
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [error, setError] = useState<string | null>(() =>
    "geolocation" in navigator ? null : "Geolocation is not supported on this device/browser."
  );
  const lastSavedAt = useRef(0);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setDriverPos(coords);
        setTrail((prev) => [...prev.slice(-50), coords]);

        const now = Date.now();
        if (now - lastSavedAt.current > 15000) {
          lastSavedAt.current = now;
          supabase
            .from("driver_positions")
            .insert({ driver_id: driverId, lat: coords[0], lng: coords[1] })
            .then(({ error: insertError }) => {
              if (insertError) console.error(insertError);
            });
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [driverId, supabase]);

  const locationPoints = locations
    .filter((l) => l.lat != null && l.lng != null)
    .map((l) => [l.lat as number, l.lng as number] as [number, number]);

  const boundsPoints = driverPos ? [driverPos, ...locationPoints] : locationPoints;
  const center: [number, number] = driverPos ?? locationPoints[0] ?? [-6.2, 106.8];

  return (
    <div>
      {error && (
        <p className="mb-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          {error} — showing assigned locations only.
        </p>
      )}
      <div className="h-[70vh] w-full rounded-xl overflow-hidden border border-slate-200">
        <MapContainer center={center} zoom={13} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={boundsPoints} />

          {trail.length > 1 && <Polyline positions={trail} color="#2563eb" weight={3} opacity={0.6} />}

          {driverPos && (
            <Marker position={driverPos} icon={driverIcon}>
              <Popup>You are here</Popup>
            </Marker>
          )}

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
        </MapContainer>
      </div>
    </div>
  );
}
