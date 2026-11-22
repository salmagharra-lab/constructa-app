import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import CheckInPanel from "@/components/worker/CheckInPanel";
import { requireRole } from "@/lib/auth";
import { locationPath } from "@/lib/locations";
import { localDateString } from "@/lib/time";
import type { Attendance, LocationRow, Project, Task } from "@/lib/types";

type Membership = { project_id: string; projects: Project | null };

export default async function WorkerHome({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { supabase, profile } = await requireRole("worker");
  const t = await getTranslations("worker");
  const tt = await getTranslations("task");
  const locale = await getLocale();
  const { project: projectParam } = await searchParams;

  const { data: memberships } = await supabase
    .from("project_members")
    .select("project_id, projects(id, owner_id, name, address, lat, lng, radius_m)")
    .eq("user_id", profile.id)
    .returns<Membership[]>();
  const projects = (memberships ?? []).map((m) => m.projects).filter((p): p is Project => !!p);

  const { data: openShift } = await supabase
    .from("attendance")
    .select("*")
    .eq("user_id", profile.id)
    .is("check_out_at", null)
    .maybeSingle<Attendance>();

  const project =
    projects.find((p) => p.id === projectParam) ??
    projects.find((p) => p.id === openShift?.project_id) ??
    projects[0];

  const today = localDateString();
  let tasks: Task[] = [];
  let locations: LocationRow[] = [];
  if (project) {
    const [{ data: taskRows }, { data: locRows }] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("project_id", project.id)
        .lte("due_date", today)
        .order("status")
        .order("due_date")
        .order("created_at")
        .returns<Task[]>(),
      supabase.from("locations").select("*").eq("project_id", project.id).returns<LocationRow[]>(),
    ]);
    // Today's tasks + older tasks that are still open.
    tasks = (taskRows ?? []).filter((task) => task.due_date === today || task.status === "open");
    locations = locRows ?? [];
  }
  const done = tasks.filter((task) => task.status === "done").length;

  return (
    <>
      <Header home="/worker" name={profile.full_name} />
      <main className="mx-auto max-w-lg space-y-4 p-4 pb-16">
        <h1 className="text-2xl font-bold">{t("hello", { name: profile.full_name || profile.email || "" })}</h1>

        {!project ? (
          <div className="card text-lg leading-8">{t("noProject")}</div>
        ) : (
          <>
            {projects.length > 1 && (
              <nav className="flex gap-2 overflow-x-auto pb-1" aria-label={t("project")}>
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/worker?project=${p.id}`}
                    className={`btn shrink-0 ${p.id === project.id ? "bg-stone-900 text-white" : "border border-stone-300 bg-white"}`}
                  >
                    {p.name}
                  </Link>
                ))}
              </nav>
            )}

            <CheckInPanel
              projectId={project.id}
              projectName={project.name}
              address={project.address}
              openShift={openShift ? { projectId: openShift.project_id, checkInAt: openShift.check_in_at } : null}
              otherProjectName={
                openShift && openShift.project_id !== project.id
                  ? (projects.find((p) => p.id === openShift.project_id)?.name ?? "")
                  : null
              }
            />

            <section>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-xl font-bold">{t("todayTasks")}</h2>
                {tasks.length > 0 && (
                  <span className="text-sm text-stone-500">{t("doneCount", { done, total: tasks.length })}</span>
                )}
              </div>
              {tasks.length === 0 ? (
                <div className="card text-center text-lg text-stone-500">{t("noTasks")}</div>
              ) : (
                <ul className="space-y-3">
                  {tasks.map((task) => {
                    const isDone = task.status === "done";
                    return (
                      <li key={task.id}>
                        <Link
                          href={`/worker/tasks/${task.id}`}
                          className={`card flex min-h-20 items-center gap-4 ${isDone ? "bg-green-50" : "active:bg-amber-50"}`}
                        >
                          <span
                            aria-hidden
                            className={`grid size-12 shrink-0 place-items-center rounded-full text-2xl font-bold ${
                              isDone ? "bg-green-600 text-white" : "border-4 border-stone-300 text-stone-300"
                            }`}
                          >
                            {isDone ? "✓" : ""}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-lg font-semibold ${isDone ? "text-green-900" : ""}`}>
                              {task.title}
                            </span>
                            <span className="block truncate text-sm text-stone-500">
                              {task.location_id ? `📍 ${locationPath(locations, task.location_id)}` : ""}
                              {task.video_url ? " · ▶" : ""}
                            </span>
                            {!isDone && task.due_date < today && (
                              <span className="mt-1 inline-block rounded bg-red-100 px-2 text-xs font-semibold text-red-700">
                                {tt("overdue")} · {new Date(task.due_date).toLocaleDateString(locale)}
                              </span>
                            )}
                          </span>
                          <span aria-hidden className="text-2xl text-stone-300 rtl:rotate-180">
                            ›
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
