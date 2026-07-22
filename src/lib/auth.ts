import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Fetches the signed-in user's profile (role, name, phone) on the server. Null if signed out. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile as Profile | null;
}
