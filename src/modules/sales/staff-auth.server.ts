export async function requireStaff(
  userId: string,
  supabase: { from: (t: string) => ReturnType<import("@supabase/supabase-js").SupabaseClient["from"]> },
): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (!profile || !["orbia_admin", "orbia_staff"].includes(profile.role as string)) {
    throw new Error("Apenas equipe Orbia.");
  }
}
