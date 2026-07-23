import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { Navbar } from "@/components/shared/Navbar";
import { BottomNav } from "@/components/shared/BottomNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/driver/locations");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar profile={profile} />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:pb-6">{children}</main>
      <BottomNav profile={profile} />
    </div>
  );
}
