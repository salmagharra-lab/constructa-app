"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/** Re-renders the server page whenever attendance or tasks of the project change. */
export default function RealtimeRefresher({ projectId, label }: { projectId: string; label: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };
    const filter = `project_id=eq.${projectId}`;
    const channel = supabase
      .channel(`project-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter }, refresh)
      .subscribe();
    // Also refresh hours every minute.
    const tick = setInterval(() => router.refresh(), 60000);
    return () => {
      clearInterval(tick);
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [projectId, router]);

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
      <span className="size-2 animate-pulse rounded-full bg-green-600" aria-hidden />
      {label}
    </span>
  );
}
