"use client";

import { useRouter, usePathname } from "next/navigation";

export function ProjectFilterSelect({
  projects,
  value,
}: {
  projects: { id: string; name: string }[];
  value: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      defaultValue={value}
      onChange={(e) => {
        const v = e.target.value;
        router.push(v ? `${pathname}?project=${v}` : pathname);
      }}
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">All projects</option>
      {projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
