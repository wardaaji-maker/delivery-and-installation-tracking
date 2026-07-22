"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Upload, X } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface ParsedRow {
  label: string;
  address: string;
  lat: string;
  lng: string;
  receiver_name: string;
  receiver_phone: string;
  notes: string;
}

const COLUMN_ALIASES: Record<string, keyof ParsedRow> = {
  label: "label",
  name: "label",
  location: "label",
  "location name": "label",
  address: "address",
  lat: "lat",
  latitude: "lat",
  lng: "lng",
  lon: "lng",
  longitude: "lng",
  receiver: "receiver_name",
  "receiver name": "receiver_name",
  "receiver_name": "receiver_name",
  "contact name": "receiver_name",
  phone: "receiver_phone",
  "receiver phone": "receiver_phone",
  "receiver_phone": "receiver_phone",
  "phone number": "receiver_phone",
  notes: "notes",
  note: "notes",
};

function normalizeRow(raw: Record<string, unknown>): ParsedRow {
  const row: ParsedRow = {
    label: "",
    address: "",
    lat: "",
    lng: "",
    receiver_name: "",
    receiver_phone: "",
    notes: "",
  };
  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = COLUMN_ALIASES[key.trim().toLowerCase()];
    if (normalizedKey && value != null) {
      row[normalizedKey] = String(value).trim();
    }
  }
  return row;
}

export function BulkLocationImport({ projectId }: { projectId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function handleFile(file: File) {
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setRows(results.data.map(normalizeRow).filter((r) => r.label || r.address));
        },
        error: (err) => toast.error(`Failed to parse CSV: ${err.message}`),
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        setRows(json.map(normalizeRow).filter((r) => r.label || r.address));
      };
      reader.onerror = () => toast.error("Failed to read Excel file");
      reader.readAsBinaryString(file);
    }
  }

  function clearFile() {
    setRows([]);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);

    const payload = rows.map((r) => ({
      project_id: projectId,
      label: r.label || r.address || "Untitled location",
      address: r.address || r.label,
      lat: r.lat ? Number(r.lat) : null,
      lng: r.lng ? Number(r.lng) : null,
      receiver_name: r.receiver_name || null,
      receiver_phone: r.receiver_phone || null,
      notes: r.notes || null,
    }));

    const { error } = await supabase.from("locations").insert(payload);

    setImporting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Imported ${payload.length} location${payload.length === 1 ? "" : "s"}`);
    clearFile();
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold text-slate-900 mb-1">Bulk import locations</h3>
      <p className="text-sm text-slate-500 mb-4">
        Upload a .csv or .xlsx file with columns like{" "}
        <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">label, address, lat, lng, receiver_name, receiver_phone, notes</code>
      </p>

      {!fileName ? (
        <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition">
          <Upload className="h-6 w-6 text-slate-400" />
          <span className="text-sm text-slate-500">Click to select a CSV or Excel file</span>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-700">
              <span className="font-medium">{fileName}</span> — {rows.length} row
              {rows.length === 1 ? "" : "s"} parsed
            </p>
            <button onClick={clearFile} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          {rows.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 mb-4">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Label</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Address</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Receiver</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 text-slate-700">{r.label}</td>
                      <td className="px-3 py-1.5 text-slate-500">{r.address}</td>
                      <td className="px-3 py-1.5 text-slate-500">{r.receiver_name}</td>
                      <td className="px-3 py-1.5 text-slate-500">{r.receiver_phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && (
                <p className="text-center text-xs text-slate-400 py-2">
                  + {rows.length - 50} more rows
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={importing || rows.length === 0}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60"
          >
            {importing ? "Importing..." : `Import ${rows.length} location${rows.length === 1 ? "" : "s"}`}
          </button>
        </div>
      )}
    </div>
  );
}
