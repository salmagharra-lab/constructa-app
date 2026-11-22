import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";
import type { Profile, Role } from "./types";

export async function getSession() {
  if (!isSupabaseConfigured) redirect("/");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) redirect("/login");
  return { supabase, user, profile };
}

export async function requireRole(role: Role) {
  const session = await getSession();
  if (session.profile.role !== role) redirect("/");
  return session;
}
