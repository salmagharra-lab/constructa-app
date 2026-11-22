import { getLocale, getTranslations } from "next-intl/server";
import RealtimeRefresher from "@/components/manager/RealtimeRefresher";
import { requireRole } from "@/lib/auth";
import { flattenTree, locationPath } from "@/lib/locations";
import { formatDateTime, formatTime, hoursBetween, localDateString, startOfLocalDay } from "@/lib/time";
import type { Attendance, LocationProgress, LocationRow, Member, Task } from "@/lib/types";

type AttendanceWithName = Attendance & { profiles: { full_name: string; email: string | null } | null };

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-stone-200">
        <div
          className={`h-full rounded-full ${pct === 100 ? "bg-green-600" : "bg-amber-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-24 text-end text-sm tabular-nums text-stone-600">
        {pct}% · {done}/{total}
      </span>
    </div>
  );
}

export default async function ProjectDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; worker?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireRole("manager");
  const t = await getTranslations("manager");
  const tk = await getTranslations("kinds");
  const locale = await getLocale();

  const today = localDateString();
  const dayStart = startOfLocalDay(today).toISOString();
  const galleryDate = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : "";
  const galleryWorker = sp.worker && /^[0-9a-f-]{36}$/i.test(sp.worker) ? sp.worker : "";

  let galleryQuery = supabase
    .from("tasks")
    .select("*")
    .eq("project_id", id)
    .eq("status", "done")
    .not("photo_path", "is", null)
    .order("completed_at", { ascending: false })
    .limit(30);
  if (galleryDate) {
    const from = startOfLocalDay(galleryDate);
    const to = new Date(from.getTime() + 36 * 3600_000); // next local midnight, DST-safe below
    const nextDay = startOfLocalDay(localDateString(to));
    galleryQuery = galleryQuery.gte("completed_at", from.toISOString()).lt("completed_at", nextDay.toISOString());
  }
  if (galleryWorker) galleryQuery = galleryQuery.eq("completed_by", galleryWorker);

  const [{ data: shifts }, { data: progress }, { data: allTasks }, { data: photos }, { data: members }, { data: locRows }] =
    await Promise.all([
      supabase
        .from("attendance")
        .select("*, profiles!attendance_user_id_fkey(full_name, email)")
        .eq("project_id", id)
        .or(`check_in_at.gte.${dayStart},check_out_at.is.null,check_out_at.gte.${dayStart}`)
        .order("check_in_at")
        .returns<AttendanceWithName[]>(),
      supabase.from("location_progress").select("*").eq("project_id", id).returns<LocationProgress[]>(),
      supabase.from("tasks").select("status").eq("project_id", id).returns<Pick<Task, "status">[]>(),
      galleryQuery.returns<Task[]>(),
      supabase
        .from("project_members")
        .select("user_id, team_id, profiles(full_name, email)")
        .eq("project_id", id)
        .returns<Member[]>(),
      supabase.from("locations").select("*").eq("project_id", id).returns<LocationRow[]>(),
    ]);

  // Hours per worker today (shifts that started before midnight are counted from midnight).
  const now = Date.now();
  const perWorker = new Map<string, { name: string; hours: number; onSite: AttendanceWithName | null }>();
  for (const s of shifts ?? []) {
    const name = s.profiles?.full_name || s.profiles?.email || "—";
    const entry = perWorker.get(s.user_id) ?? { name, hours: 0, onSite: null };
    const start = s.check_in_at < dayStart ? dayStart : s.check_in_at;
    entry.hours += hoursBetween(start, s.check_out_at, now);
    if (!s.check_out_at) entry.onSite = s;
    perWorker.set(s.user_id, entry);
  }
  const onSite = [...perWorker.values()].filter((w) => w.onSite);
  const worked = [...perWorker.values()].sort((a, b) => b.hours - a.hours);

  const totalTasks = allTasks?.length ?? 0;
  const doneTasks = allTasks?.filter((x) => x.status === "done").length ?? 0;
  const tree = flattenTree(progress ?? []).filter((l) => l.depth <= 2);

  const paths = (photos ?? []).map((p) => p.photo_path!).filter(Boolean);
  const { data: signed } = paths.length
    ? await supabase.storage.from("task-photos").createSignedUrls(paths, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const nameOf = (uid: string | null) => {
    const p = members?.find((m) => m.user_id === uid)?.profiles;
    return p?.full_name || p?.email || "—";
  };

  return (
    <>
      <div className="flex justify-end">
        <RealtimeRefresher projectId={id} label={t("live")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2">
            🟢 {t("onSiteNow")} <span className="text-stone-400">({onSite.length})</span>
          </h2>
          {onSite.length === 0 ? (
            <p className="text-stone-500">{t("nobodyOnSite")}</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {onSite.map((w) => (
                <li key={w.onSite!.id} className="flex items-center gap-3 py-2">
                  <span className="size-2.5 rounded-full bg-green-600" aria-hidden />
                  <span className="flex-1 font-medium">{w.name}</span>
                  <span className="text-sm text-stone-500">
                    {formatTime(w.onSite!.check_in_at, locale)}
                    {w.onSite!.check_in_distance_m != null && ` · ${t("distance", { m: w.onSite!.check_in_distance_m })}`}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mb-2 mt-5 font-bold">🕒 {t("hoursToday")}</h3>
          {worked.length === 0 ? (
            <p className="text-stone-500">—</p>
          ) : (
            <ul className="space-y-1">
              {worked.map((w) => (
                <li key={w.name + w.hours} className="flex justify-between text-sm">
                  <span>{w.name}</span>
                  <span className="tabular-nums">{t("hours", { h: w.hours.toFixed(1) })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="h2">📈 {t("progress")}</h2>
          <div className="mb-4">
            <p className="mb-1 font-semibold">{t("overall")}</p>
            <Bar done={doneTasks} total={totalTasks} />
          </div>
          {tree.length === 0 ? (
            <p className="text-stone-500">{t("noLocations")}</p>
          ) : (
            <ul className="space-y-3">
              {tree.map((l) => (
                <li key={l.id} style={{ paddingInlineStart: l.depth * 16 }}>
                  <p className="mb-1 text-sm font-medium">
                    {tk(l.kind)} {l.name}
                  </p>
                  <Bar done={l.done} total={l.total} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold">📷 {t("gallery")}</h2>
          <form className="ms-auto flex flex-wrap gap-2">
            <input type="date" name="date" defaultValue={galleryDate} className="input min-h-10 w-auto" aria-label={t("date")} />
            <select name="worker" defaultValue={galleryWorker} className="input min-h-10 w-auto" aria-label={t("worker")}>
              <option value="">{t("allWorkers")}</option>
              {members?.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profiles?.full_name || m.profiles?.email}
                </option>
              ))}
            </select>
            <button className="btn-ghost min-h-10">{t("filter")}</button>
          </form>
        </div>
        {!photos?.length ? (
          <p className="text-stone-500">{t("noPhotos")}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => {
              const url = urlFor.get(p.photo_path);
              return (
                <li key={p.id} id={`photo-${p.id}`} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={p.title} loading="lazy" className="aspect-square w-full object-cover" />
                    </a>
                  ) : (
                    <div className="aspect-square bg-stone-100" />
                  )}
                  <div className="space-y-0.5 p-2 text-xs">
                    <p className="truncate text-sm font-semibold">{p.title}</p>
                    {p.location_id && <p className="truncate text-stone-500">📍 {locationPath(locRows ?? [], p.location_id)}</p>}
                    <p className="text-stone-500">
                      👷 {nameOf(p.completed_by)} · {formatDateTime(p.completed_at, locale)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
