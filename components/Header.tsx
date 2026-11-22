import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/actions";
import LangSwitcher from "./LangSwitcher";

export default async function Header({ home, name }: { home: string; name?: string }) {
  const t = await getTranslations("common");
  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2">
        <Link href={home} className="flex items-center gap-2 text-lg font-black tracking-tight">
          <span className="grid size-8 place-items-center rounded-lg bg-amber-500 text-stone-900" aria-hidden>
            ▲
          </span>
          {t("appName")}
        </Link>
        <span className="ms-auto hidden truncate text-sm text-stone-500 sm:block">{name}</span>
        <LangSwitcher />
        {name !== undefined && (
          <form action={signOut}>
            <button className="min-h-10 rounded-lg px-3 text-sm font-medium text-stone-600 hover:bg-stone-100">
              {t("logout")}
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
