import type { LocationRow } from "./types";

type Node = Pick<LocationRow, "id" | "parent_id" | "name">;

/** "Building A › Floor 3 › Unit 12 › Bathroom" */
export function locationPath(locations: Node[], id: string | null): string {
  if (!id) return "";
  const byId = new Map(locations.map((l) => [l.id, l]));
  const names: string[] = [];
  let cur = byId.get(id);
  let guard = 0;
  while (cur && guard++ < 20) {
    names.unshift(cur.name);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return names.join(" › ");
}

/** Depth-first ordering with depth, for indented trees and <select>s. */
export function flattenTree<T extends Node & Pick<LocationRow, "sort">>(rows: T[]): (T & { depth: number })[] {
  const ids = new Set(rows.map((r) => r.id));
  const children = new Map<string | null, T[]>();
  for (const r of rows) {
    const key = r.parent_id && ids.has(r.parent_id) ? r.parent_id : null;
    children.set(key, [...(children.get(key) ?? []), r]);
  }
  for (const list of children.values()) list.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const out: (T & { depth: number })[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const r of children.get(parent) ?? []) {
      out.push({ ...r, depth });
      if (depth < 20) walk(r.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
