"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { geocodeAddress } from "@/lib/geocode";

export function AddLocationForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  function reset() {
    setLabel("");
    setAddress("");
    setReceiverName("");
    setReceiverPhone("");
    setLat("");
    setLng("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    let finalLat = lat ? Number(lat) : null;
    let finalLng = lng ? Number(lng) : null;

    if (finalLat == null && finalLng == null) {
      const geocoded = await geocodeAddress(address);
      if (geocoded) {
        finalLat = geocoded.lat;
        finalLng = geocoded.lng;
      } else {
        toast("Couldn't auto-locate that address on the map — you can add coordinates later", {
          icon: "⚠️",
        });
      }
    }

    const { error } = await supabase.from("locations").insert({
      project_id: projectId,
      label,
      address,
      receiver_name: receiverName || null,
      receiver_phone: receiverPhone || null,
      lat: finalLat,
      lng: finalLng,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Location added");
    reset();
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
      >
        <Plus className="h-4 w-4" />
        Add single location
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <h3 className="font-semibold text-slate-900">Add location</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <input
          required
          placeholder="Label (e.g. Site A)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          required
          placeholder="Address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          placeholder="Receiver name"
          value={receiverName}
          onChange={(e) => setReceiverName(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          placeholder="Receiver phone (for WhatsApp)"
          value={receiverPhone}
          onChange={(e) => setReceiverPhone(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          placeholder="Latitude (auto-detected if left blank)"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          placeholder="Longitude (auto-detected if left blank)"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60"
        >
          {loading ? "Locating & adding..." : "Add location"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
