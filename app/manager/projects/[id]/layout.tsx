import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import ProjectTabs from "@/components/manager/ProjectTabs";
import { requireRole } from "@/lib/auth";
import type { Project } from "@/lib/types";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireRole("manager");
  const t = await getTranslations("manager");
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("owner_id", profile.id)
    .maybeSingle<Project>();
  if (!project) notFound();

  return (
    <>
      <Header home="/manager" name={profile.full_name} />
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <Link href="/manager" className="text-sm text-stone-500 hover:underline">
          {t("projects")}
        </Link>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        {project.address && <p className="text-sm text-stone-500">{project.address}</p>}
        <div className="mt-3">
          <ProjectTabs projectId={project.id} />
        </div>
      </div>
      <main className="mx-auto max-w-5xl space-y-6 p-4 pb-16">{children}</main>
    </>
  );
}
