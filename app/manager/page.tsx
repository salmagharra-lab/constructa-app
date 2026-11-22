import Link from "next/link";
import { getTranslations } from "next-intl/server";
import ErrorBanner from "@/components/ErrorBanner";
import Header from "@/components/Header";
import ProjectFields from "@/components/manager/ProjectFields";
import { requireRole } from "@/lib/auth";
import type { Project } from "@/lib/types";
import { createProject } from "./actions";

export default async function ManagerHome({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { supabase, profile } = await requireRole("manager");
  const t = await getTranslations("manager");
  const { error } = await searchParams;

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false })
    .returns<Project[]>();

  return (
    <>
      <Header home="/manager" name={profile.full_name} />
      <main className="mx-auto max-w-5xl space-y-6 p-4 pb-16">
        <ErrorBanner code={error} />
        <section>
          <h1 className="mb-3 text-2xl font-bold">{t("projects")}</h1>
          {!projects?.length ? (
            <p className="card text-stone-500">{t("noProjects")}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/manager/projects/${p.id}`} className="card block hover:border-amber-400">
                    <span className="block text-lg font-bold">{p.name}</span>
                    <span className="block text-sm text-stone-500">{p.address || "—"}</span>
                    <span className="mt-2 block text-xs text-stone-400">
                      📍 {p.radius_m} m
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="h2">＋ {t("newProject")}</h2>
          <form action={createProject} className="space-y-4">
            <ProjectFields />
            <button className="btn-primary">{t("create")}</button>
          </form>
        </section>
      </main>
    </>
  );
}
