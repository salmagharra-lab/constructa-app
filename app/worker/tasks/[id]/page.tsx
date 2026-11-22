import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import TaskVideo from "@/components/TaskVideo";
import CompleteTask from "@/components/worker/CompleteTask";
import { requireRole } from "@/lib/auth";
import { locationPath } from "@/lib/locations";
import { formatDateTime } from "@/lib/time";
import type { LocationRow, Task } from "@/lib/types";

export default async function WorkerTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireRole("worker");
  const t = await getTranslations("task");
  const tc = await getTranslations("common");
  const locale = await getLocale();

  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle<Task>();

  let locations: LocationRow[] = [];
  let photoUrl: string | null = null;
  if (task) {
    const { data } = await supabase.from("locations").select("*").eq("project_id", task.project_id);
    locations = (data ?? []) as LocationRow[];
    if (task.photo_path) {
      const { data: signed } = await supabase.storage.from("task-photos").createSignedUrl(task.photo_path, 3600);
      photoUrl = signed?.signedUrl ?? null;
    }
  }

  return (
    <>
      <Header home="/worker" name={profile.full_name} />
      <main className="mx-auto max-w-lg space-y-4 p-4 pb-16">
        <Link href={task ? `/worker?project=${task.project_id}` : "/worker"} className="btn-ghost">
          <span className="rtl:rotate-180" aria-hidden>
            ‹
          </span>
          {tc("back")}
        </Link>

        {!task ? (
          <div className="card">{t("notFound")}</div>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold">{task.title}</h1>
              {task.location_id && (
                <p className="mt-1 text-lg text-stone-600">📍 {locationPath(locations, task.location_id)}</p>
              )}
            </div>

            {task.video_url && (
              <section className="card">
                <h2 className="h2">▶ {t("video")}</h2>
                <TaskVideo url={task.video_url} label={t("openVideo")} />
              </section>
            )}

            {task.instructions && (
              <section className="card">
                <h2 className="h2">📋 {t("instructions")}</h2>
                <p className="whitespace-pre-line text-lg leading-8">{task.instructions}</p>
              </section>
            )}

            {task.status === "done" ? (
              <section className="card space-y-3 border-green-300 bg-green-50">
                <p className="text-xl font-bold text-green-800">
                  ✓ {t("completedAt", { time: formatDateTime(task.completed_at, locale) })}
                </p>
                {photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt={task.title} className="w-full rounded-xl" />
                )}
              </section>
            ) : (
              <CompleteTask taskId={task.id} projectId={task.project_id} />
            )}
          </>
        )}
      </main>
    </>
  );
}
