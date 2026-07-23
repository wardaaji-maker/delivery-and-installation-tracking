/** Client-side address geocoding via OpenStreetMap's free Nominatim API. No API key required. */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim()) return null;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;

    const results: { lat: string; lon: string }[] = await res.json();
    if (results.length === 0) return null;

    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
  } catch {
    return null;
  }
}

/** Nominatim's usage policy caps public requests at ~1/sec, so bulk geocoding must be throttled. */
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
