import { getTranslations } from "next-intl/server";
import ErrorBanner from "@/components/ErrorBanner";
import { requireRole } from "@/lib/auth";
import { hoursBetween, localDateString, startOfLocalDay, toLocalInput } from "@/lib/time";
import type { Attendance, Member } from "@/lib/types";
import { addShift, saveAttendance } from "../../../actions";

type Row = Attendance & { profiles: { full_name: string; email: string | null } | null };

export default async function AttendancePage({
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
  const back = `/manager/projects/${id}/attendance?date=${date}`;

  const from = startOfLocalDay(date);
  const to = startOfLocalDay(localDateString(new Date(from.getTime() + 36 * 3600_000)));

  const [{ data: rows }, { data: members }] = await Promise.all([
    supabase
      .from("attendance")
      .select("*, profiles!attendance_user_id_fkey(full_name, email)")
      .eq("project_id", id)
      .gte("check_in_at", from.toISOString())
      .lt("check_in_at", to.toISOString())
      .order("check_in_at")
      .returns<Row[]>(),
    supabase
      .from("project_members")
      .select("user_id, team_id, profiles(full_name, email)")
      .eq("project_id", id)
      .returns<Member[]>(),
  ]);
  const total = (rows ?? []).reduce((sum, r) => sum + hoursBetween(r.check_in_at, r.check_out_at), 0);

  return (
    <>
      <ErrorBanner code={sp.error} />

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold">🕒 {t("attendanceTab")}</h2>
          <span className="text-sm text-stone-500">
            {t("totalHours")}: {t("hours", { h: total.toFixed(1) })}
          </span>
          <form className="ms-auto flex gap-2">
            <input type="date" name="date" defaultValue={date} className="input min-h-10 w-auto" aria-label={t("date")} />
            <button className="btn-ghost min-h-10">{t("filter")}</button>
          </form>
        </div>

        {!rows?.length ? (
          <p className="text-stone-500">—</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl border border-stone-200 p-3">
                <form action={saveAttendance} className="grid items-end gap-2 sm:grid-cols-[1fr_auto_auto_1fr_auto]">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="return_to" value={back} />
                  <div>
                    <p className="font-semibold">{r.profiles?.full_name || r.profiles?.email}</p>
                    <p className="text-xs text-stone-500">
                      {t("hours", { h: hoursBetween(r.check_in_at, r.check_out_at).toFixed(1) })}
                      {!r.check_out_at && ` · 🟢 ${t("stillOnSite")}`}
                      {r.edited_at && ` · ✏️ ${t("edited")}`}
                      {r.check_in_distance_m != null && ` · ${t("distance", { m: r.check_in_distance_m })}`}
                    </p>
                  </div>
                  <label className="text-xs text-stone-500">
                    {t("checkInTime")}
                    <input
                      type="datetime-local"
                      name="check_in_at"
                      required
                      defaultValue={toLocalInput(r.check_in_at)}
                      className="input min-h-10"
                    />
                  </label>
                  <label className="text-xs text-stone-500">
                    {t("checkOutTime")}
                    <input
                      type="datetime-local"
                      name="check_out_at"
                      defaultValue={toLocalInput(r.check_out_at)}
                      className="input min-h-10"
                    />
                  </label>
                  <label className="text-xs text-stone-500">
                    {t("note")}
                    <input name="edit_note" defaultValue={r.edit_note ?? ""} className="input min-h-10" />
                  </label>
                  <button className="btn-dark min-h-10">{tc("save")}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="h2">＋ {t("addShift")}</h2>
        <form action={addShift} className="grid items-end gap-2 sm:grid-cols-[1fr_auto_auto_1fr_auto]">
          <input type="hidden" name="project_id" value={id} />
          <input type="hidden" name="return_to" value={back} />
          <label className="text-xs text-stone-500">
            {t("worker")}
            <select name="user_id" required className="input min-h-10" defaultValue="">
              <option value="" disabled>
                —
              </option>
              {members?.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profiles?.full_name || m.profiles?.email}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-stone-500">
            {t("checkInTime")}
            <input type="datetime-local" name="check_in_at" required defaultValue={`${date}T07:00`} className="input min-h-10" />
          </label>
          <label className="text-xs text-stone-500">
            {t("checkOutTime")}
            <input type="datetime-local" name="check_out_at" required defaultValue={`${date}T16:00`} className="input min-h-10" />
          </label>
          <label className="text-xs text-stone-500">
            {t("note")}
            <input name="edit_note" className="input min-h-10" />
          </label>
          <button className="btn-primary min-h-10">{tc("add")}</button>
        </form>
      </section>
    </>
  );
}
