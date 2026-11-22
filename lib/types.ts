export type Role = "manager" | "worker";
export type LocationKind = "building" | "floor" | "unit" | "room" | "area";
export const LOCATION_KINDS: LocationKind[] = ["building", "floor", "unit", "room", "area"];

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  role: Role;
  language: string;
}

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  radius_m: number;
}

export interface Team {
  id: string;
  project_id: string;
  name: string;
}

export interface LocationRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  kind: LocationKind;
  name: string;
  sort: number;
}

export interface LocationProgress extends LocationRow {
  total: number;
  done: number;
}

export interface Task {
  id: string;
  project_id: string;
  location_id: string | null;
  title: string;
  instructions: string | null;
  video_url: string | null;
  assignee_id: string | null;
  team_id: string | null;
  due_date: string;
  status: "open" | "done";
  completed_at: string | null;
  completed_by: string | null;
  photo_path: string | null;
}

export interface Attendance {
  id: string;
  user_id: string;
  project_id: string;
  check_in_at: string;
  check_out_at: string | null;
  check_in_distance_m: number | null;
  edited_by: string | null;
  edit_note: string | null;
  edited_at: string | null;
}

export interface Member {
  user_id: string;
  team_id: string | null;
  profiles: { full_name: string; email: string | null } | null;
}
