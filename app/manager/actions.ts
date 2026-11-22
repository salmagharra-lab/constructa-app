"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseRpcError } from "@/lib/rpcErrors";
import { fromLocalInput } from "@/lib/time";
import { LOCATION_KINDS, type LocationKind } from "@/lib/types";
import { isHttpUrl } from "@/lib/video";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optional = (f: FormData, k: string) => str(f, k) || null;

/** Only allow redirects back into the manager area. */
function returnTo(f: FormData, fallback: string) {
  const r = str(f, "return_to");
  return r.startsWith("/manager") && !r.startsWith("//") ? r : fallback;
}

function withParam(path: string, key: string, value: string) {
  const url = new URL(path, "http://x");
  url.searchParams.set(key, value);
  return url.pathname + url.search;
}

function fail(path: string, code: string): never {
  redirect(withParam(path, "error", code));
}

function done(path: string): never {
  revalidatePath("/manager", "layout");
  const url = new URL(path, "http://x");
  url.searchParams.delete("error");
  redirect(url.pathname + url.search);
}

async function db() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function readProjectFields(f: FormData) {
  const lat = Number(str(f, "lat"));
  const lng = Number(str(f, "lng"));
  const radius = Math.round(Number(str(f, "radius_m") || 150));
  const name = str(f, "name");
  const valid =
    name && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
    radius >= 20 && radius <= 5000 && str(f, "lat") !== "" && str(f, "lng") !== "";
  return valid ? { name, address: optional(f, "address"), lat, lng, radius_m: radius } : null;
}

// --- Projects ---------------------------------------------------------------

export async function createProject(f: FormData) {
  const { supabase, user } = await db();
  const fields = readProjectFields(f);
  if (!fields) fail("/manager", "invalid");
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...fields, owner_id: user.id })
    .select("id")
    .single();
  if (error || !data) fail("/manager", "generic");
  done(`/manager/projects/${data.id}/setup`);
}

export async function updateProject(f: FormData) {
  const { supabase } = await db();
  const id = str(f, "project_id");
  const back = returnTo(f, `/manager/projects/${id}/setup`);
  const fields = readProjectFields(f);
  if (!fields) fail(back, "invalid");
  const { error } = await supabase.from("projects").update(fields).eq("id", id);
  if (error) fail(back, "generic");
  done(back);
}

// --- Locations --------------------------------------------------------------

export async function addLocation(f: FormData) {
  const { supabase } = await db();
  const project_id = str(f, "project_id");
  const back = returnTo(f, `/manager/projects/${project_id}/setup`);
  const kind = str(f, "kind") as LocationKind;
  const name = str(f, "name");
  if (!name || !LOCATION_KINDS.includes(kind)) fail(back, "invalid");
  const { error } = await supabase
    .from("locations")
    .insert({ project_id, name, kind, parent_id: optional(f, "parent_id"), sort: Number(str(f, "sort") || 0) });
  if (error) fail(back, "generic");
  done(back);
}

export async function deleteLocation(f: FormData) {
  const { supabase } = await db();
  const back = returnTo(f, "/manager");
  const { error } = await supabase.from("locations").delete().eq("id", str(f, "id"));
  if (error) fail(back, "generic");
  done(back);
}

// --- Teams & members --------------------------------------------------------

export async function addTeam(f: FormData) {
  const { supabase } = await db();
  const project_id = str(f, "project_id");
  const back = returnTo(f, `/manager/projects/${project_id}/setup`);
  const name = str(f, "name");
  if (!name) fail(back, "invalid");
  const { error } = await supabase.from("teams").insert({ project_id, name });
  if (error) fail(back, "generic");
  done(back);
}

export async function deleteTeam(f: FormData) {
  const { supabase } = await db();
  const back = returnTo(f, "/manager");
  const { error } = await supabase.from("teams").delete().eq("id", str(f, "id"));
  if (error) fail(back, "generic");
  done(back);
}

export async function addMember(f: FormData) {
  const { supabase } = await db();
  const project_id = str(f, "project_id");
  const back = returnTo(f, `/manager/projects/${project_id}/setup`);
  const email = str(f, "email");
  if (!email) fail(back, "invalid");
  const { error } = await supabase.rpc("add_member_by_email", {
    p_project: project_id,
    p_email: email,
    p_team: optional(f, "team_id"),
  });
  if (error) fail(back, parseRpcError(error.message).code);
  done(back);
}

export async function setMemberTeam(f: FormData) {
  const { supabase } = await db();
  const project_id = str(f, "project_id");
  const back = returnTo(f, `/manager/projects/${project_id}/setup`);
  const { error } = await supabase
    .from("project_members")
    .update({ team_id: optional(f, "team_id") })
    .eq("project_id", project_id)
    .eq("user_id", str(f, "user_id"));
  if (error) fail(back, "generic");
  done(back);
}

export async function removeMember(f: FormData) {
  const { supabase } = await db();
  const project_id = str(f, "project_id");
  const back = returnTo(f, `/manager/projects/${project_id}/setup`);
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", project_id)
    .eq("user_id", str(f, "user_id"));
  if (error) fail(back, "generic");
  done(back);
}

// --- Tasks ------------------------------------------------------------------

export async function createTask(f: FormData) {
  const { supabase } = await db();
  const project_id = str(f, "project_id");
  const back = returnTo(f, `/manager/projects/${project_id}/tasks`);
  const title = str(f, "title");
  const due_date = str(f, "due_date");
  const video_url = optional(f, "video_url");
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(due_date) || (video_url && !isHttpUrl(video_url))) fail(back, "invalid");

  // assign = "" (everyone) | "user:<id>" | "team:<id>"
  const assign = str(f, "assign");
  const assignee_id = assign.startsWith("user:") ? assign.slice(5) : null;
  const team_id = assign.startsWith("team:") ? assign.slice(5) : null;

  const { error } = await supabase.from("tasks").insert({
    project_id,
    title,
    due_date,
    video_url,
    assignee_id,
    team_id,
    location_id: optional(f, "location_id"),
    instructions: optional(f, "instructions"),
  });
  if (error) fail(back, "generic");
  done(withParam(back, "date", due_date));
}

export async function deleteTask(f: FormData) {
  const { supabase } = await db();
  const back = returnTo(f, "/manager");
  const { error } = await supabase.from("tasks").delete().eq("id", str(f, "id"));
  if (error) fail(back, "generic");
  done(back);
}

// --- Attendance corrections (manager only) -----------------------------------

export async function saveAttendance(f: FormData) {
  const { supabase, user } = await db();
  const back = returnTo(f, "/manager");
  const check_in_at = fromLocalInput(str(f, "check_in_at"));
  const check_out_at = fromLocalInput(str(f, "check_out_at"));
  if (!check_in_at || (check_out_at && check_out_at < check_in_at)) fail(back, "invalid");
  const { error } = await supabase
    .from("attendance")
    .update({
      check_in_at,
      check_out_at,
      edit_note: optional(f, "edit_note"),
      edited_by: user.id,
      edited_at: new Date().toISOString(),
    })
    .eq("id", str(f, "id"));
  if (error) fail(back, "generic");
  done(back);
}

export async function addShift(f: FormData) {
  const { supabase, user } = await db();
  const project_id = str(f, "project_id");
  const back = returnTo(f, `/manager/projects/${project_id}/attendance`);
  const check_in_at = fromLocalInput(str(f, "check_in_at"));
  const check_out_at = fromLocalInput(str(f, "check_out_at"));
  const user_id = str(f, "user_id");
  if (!user_id || !check_in_at || !check_out_at || check_out_at < check_in_at) fail(back, "invalid");
  const { error } = await supabase.from("attendance").insert({
    project_id,
    user_id,
    check_in_at,
    check_out_at,
    edit_note: optional(f, "edit_note"),
    edited_by: user.id,
    edited_at: new Date().toISOString(),
  });
  if (error) fail(back, "generic");
  done(back);
}
