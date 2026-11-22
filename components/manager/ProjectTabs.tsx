"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

export default function ProjectTabs({ projectId }: { projectId: string }) {
  const t = useTranslations("manager");
  const pathname = usePathname();
  const base = `/manager/projects/${projectId}`;
  const tabs = [
    { href: base, label: t("dashboard"), icon: "📊" },
    { href: `${base}/tasks`, label: t("tasksTab"), icon: "✅" },
    { href: `${base}/attendance`, label: t("attendanceTab"), icon: "🕒" },
    { href: `${base}/setup`, label: t("setupTab"), icon: "⚙️" },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-stone-200">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex min-h-12 shrink-0 items-center gap-1 border-b-4 px-3 font-semibold ${
              active ? "border-amber-500 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <span aria-hidden>{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
