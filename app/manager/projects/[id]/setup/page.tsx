import { getTranslations } from "next-intl/server";
import ErrorBanner from "@/components/ErrorBanner";
import ProjectFields from "@/components/manager/ProjectFields";
import { requireRole } from "@/lib/auth";
import { flattenTree } from "@/lib/locations";
import { LOCATION_KINDS, type LocationRow, type Member, type Project, type Team } from "@/lib/types";
import {
  addLocation,
  addMember,
  addTeam,
  deleteLocation,
  deleteTeam,
  removeMember,
  setMemberTeam,
  updateProject,
} from "../../../actions";

export default async function SetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase } = await requireRole("manager");
  const t = await getTranslations("manager");
  const tc = await getTranslations("common");
  const tk = await getTranslations("kinds");
  const back = `/manager/projects/${id}/setup`;

  const [{ data: project }, { data: locRows }, { data: teams }, { data: members }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single<Project>(),
    supabase.from("locations").select("*").eq("project_id", id).returns<LocationRow[]>(),
    supabase.from("teams").select("*").eq("project_id", id).order("name").returns<Team[]>(),
    supabase
      .from("project_members")
      .select("user_id, team_id, profiles(full_name, email)")
      .eq("project_id", id)
      .returns<Member[]>(),
  ]);
  const locations = flattenTree(locRows ?? []);
  const hidden = (
    <>
      <input type="hidden" name="project_id" value={id} />
      <input type="hidden" name="return_to" value={back} />
    </>
  );

  return (
    <>
      <ErrorBanner code={error} />

      <section className="card">
        <h2 className="h2">{t("projectDetails")}</h2>
        <form action={updateProject} className="space-y-4">
          {hidden}
          {project && <ProjectFields project={project} />}
          <button className="btn-primary">{tc("save")}</button>
        </form>
      </section>

      <section className="card">
        <h2 className="h2">🏢 {t("locations")}</h2>
        {locations.length === 0 ? (
          <p className="mb-3 text-stone-500">{t("noLocations")}</p>
        ) : (
          <ul className="mb-4 divide-y divide-stone-100">
            {locations.map((l) => (
              <li key={l.id} className="flex items-center gap-2 py-2" style={{ paddingInlineStart: l.depth * 20 }}>
                <span className="rounded bg-stone-100 px-2 text-xs text-stone-600">{tk(l.kind)}</span>
                <span className="flex-1 font-medium">{l.name}</span>
                <form action={deleteLocation}>
                  {hidden}
                  <input type="hidden" name="id" value={l.id} />
                  <button className="min-h-10 rounded-lg px-3 text-sm text-red-700 hover:bg-red-50">{tc("delete")}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addLocation} className="grid gap-3 sm:grid-cols-4">
          {hidden}
          <div>
            <label className="label">{t("kind")}</label>
            <select name="kind" className="input" defaultValue="floor">
              {LOCATION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {tk(k)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t("name")}</label>
            <input name="name" required className="input" placeholder="3" />
          </div>
          <div>
            <label className="label">{t("parent")}</label>
            <select name="parent_id" className="input" defaultValue="">
              <option value="">{t("topLevel")}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {"— ".repeat(l.depth)}
                  {tk(l.kind)} {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-dark w-full">＋ {t("addLocation")}</button>
          </div>
        </form>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2">👷 {t("workers")}</h2>
          {!members?.length ? (
            <p className="mb-3 text-stone-500">{t("noWorkers")}</p>
          ) : (
            <ul className="mb-4 divide-y divide-stone-100">
              {members.map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{m.profiles?.full_name || "—"}</span>
                    <span className="block truncate text-xs text-stone-500" dir="ltr">
                      {m.profiles?.email}
                    </span>
                  </span>
                  <form action={setMemberTeam} className="flex gap-1">
                    {hidden}
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <select
                      name="team_id"
                      defaultValue={m.team_id ?? ""}
                      className="min-h-10 rounded-lg border border-stone-300 px-2 text-sm"
                      aria-label={t("team")}
                    >
                      <option value="">{t("noTeam")}</option>
                      {teams?.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <button className="min-h-10 rounded-lg border border-stone-300 px-2 text-sm">{tc("save")}</button>
                  </form>
                  <form action={removeMember}>
                    {hidden}
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <button className="min-h-10 rounded-lg px-2 text-sm text-red-700 hover:bg-red-50">{t("remove")}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addMember} className="space-y-3">
            {hidden}
            <div>
              <label className="label">{t("workerEmail")}</label>
              <input name="email" type="email" required dir="ltr" className="input" />
              <p className="mt-1 text-xs text-stone-500">{t("workerEmailHint")}</p>
            </div>
            <div className="flex gap-2">
              <select name="team_id" className="input" defaultValue="" aria-label={t("team")}>
                <option value="">{t("noTeam")}</option>
                {teams?.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <button className="btn-dark shrink-0">＋ {t("addWorker")}</button>
            </div>
          </form>
        </section>

        <section className="card">
          <h2 className="h2">👥 {t("teams")}</h2>
          <ul className="mb-4 divide-y divide-stone-100">
            {teams?.map((team) => (
              <li key={team.id} className="flex items-center gap-2 py-2">
                <span className="flex-1 font-medium">{team.name}</span>
                <span className="text-xs text-stone-500">
                  {members?.filter((m) => m.team_id === team.id).length ?? 0} 👷
                </span>
                <form action={deleteTeam}>
                  {hidden}
                  <input type="hidden" name="id" value={team.id} />
                  <button className="min-h-10 rounded-lg px-3 text-sm text-red-700 hover:bg-red-50">{tc("delete")}</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addTeam} className="flex gap-2">
            {hidden}
            <input name="name" required className="input" placeholder={t("teamName")} aria-label={t("teamName")} />
            <button className="btn-dark shrink-0">＋ {t("addTeam")}</button>
          </form>
        </section>
      </div>
    </>
  );
}
