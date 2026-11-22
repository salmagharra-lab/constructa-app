import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import ErrorBanner from "@/components/ErrorBanner";
import { requireRole } from "@/lib/auth";
import { flattenTree, locationPath } from "@/lib/locations";
import { formatTime, localDateString } from "@/lib/time";
import type { LocationRow, Member, Task, Team } from "@/lib/types";
import { createTask, deleteTask } from "../../../actions";

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; date?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : localDateString();
  const { supabase } = await requireRole("manager");
  const t = await getTranslations("manager");
  const tc = await getTranslations("common");
  const tk = await getTranslations("kinds");
  const locale = await getLocale();
  const back = `/manager/projects/${id}/tasks?date=${date}`;

  const [{ data: tasks }, { data: locRows }, { data: teams }, { data: members }] = await Promise.all([
    supabase.from("tasks").select("*").eq("project_id", id).eq("due_date", date).order("created_at").returns<Task[]>(),
    supabase.from("locations").select("*").eq("project_id", id).returns<LocationRow[]>(),
    supabase.from("teams").select("*").eq("project_id", id).order("name").returns<Team[]>(),
    supabase
      .from("project_members")
      .select("user_id, team_id, profiles(full_name, email)")
      .eq("project_id", id)
      .returns<Member[]>(),
  ]);
  const locations = flattenTree(locRows ?? []);
  const nameOf = (uid: string | null) =>
    members?.find((m) => m.user_id === uid)?.profiles?.full_name || members?.find((m) => m.user_id === uid)?.profiles?.email || "";

  function assignLabel(task: Task) {
    if (task.assignee_id) return `👷 ${nameOf(task.assignee_id)}`;
    if (task.team_id) return `👥 ${teams?.find((x) => x.id === task.team_id)?.name ?? ""}`;
    return `👥 ${t("everyone")}`;
  }

  return (
    <>
      <ErrorBanner code={sp.error} />

      <section className="card">
        <h2 className="h2">＋ {t("newTask")}</h2>
        <form action={createTask} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="project_id" value={id} />
          <input type="hidden" name="return_to" value={back} />
          <div className="sm:col-span-2">
            <label className="label">{t("title")}</label>
            <input name="title" required className="input" />
          </div>
          <div>
            <label className="label">{t("location")}</label>
            <select name="location_id" className="input" defaultValue="">
              <option value="">{t("noLocation")}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {"— ".repeat(l.depth)}
                  {tk(l.kind)} {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("assign")}</label>
            <select name="assign" className="input" defaultValue="">
              <option value="">{t("everyone")}</option>
              {teams?.map((team) => (
                <option key={team.id} value={`team:${team.id}`}>
                  {t("teamPrefix")} {team.name}
                </option>
              ))}
              {members?.map((m) => (
                <option key={m.user_id} value={`user:${m.user_id}`}>
                  👷 {m.profiles?.full_name || m.profiles?.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("dueDate")}</label>
            <input name="due_date" type="date" required defaultValue={date} className="input" />
          </div>
          <div>
            <label className="label">
              {t("videoUrl")} <span className="text-stone-400">({tc("optional")})</span>
            </label>
            <input name="video_url" type="url" dir="ltr" className="input" placeholder="https://youtu.be/…" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">
              {t("instructions")} <span className="text-stone-400">({tc("optional")})</span>
            </label>
            <textarea name="instructions" rows={3} className="input py-2" />
          </div>
          <div>
            <button className="btn-primary">{t("createTask")}</button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold">{t("taskList")}</h2>
          <form className="ms-auto flex gap-2">
            <input type="date" name="date" defaultValue={date} className="input min-h-10 w-auto" aria-label={t("date")} />
            <button className="btn-ghost min-h-10">{t("filter")}</button>
          </form>
        </div>
        {!tasks?.length ? (
          <p className="text-stone-500">{t("noTaskList")}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {tasks.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center gap-3 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    task.status === "done" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {task.status === "done" ? `✓ ${t("statusDone")}` : t("statusOpen")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{task.title}</span>
                  <span className="block text-sm text-stone-500">
                    {task.location_id && `📍 ${locationPath(locRows ?? [], task.location_id)} · `}
                    {assignLabel(task)}
                    {task.video_url && " · ▶"}
                    {task.status === "done" &&
                      ` · ${t("by", { name: nameOf(task.completed_by) })} ${formatTime(task.completed_at, locale)}`}
                  </span>
                </span>
                {task.status === "done" && (
                  <Link href={`/manager/projects/${id}#photo-${task.id}`} className="text-sm text-amber-700 underline">
                    📷
                  </Link>
                )}
                <form action={deleteTask}>
                  <input type="hidden" name="id" value={task.id} />
                  <input type="hidden" name="return_to" value={back} />
                  <button className="min-h-10 rounded-lg px-3 text-sm text-red-700 hover:bg-red-50">{tc("delete")}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
