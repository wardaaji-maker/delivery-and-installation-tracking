import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { Navbar } from "@/components/shared/Navbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/driver/locations");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar profile={profile} />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
