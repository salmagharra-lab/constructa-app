"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/app/actions";
import { localeNames, locales } from "@/lib/i18n";

export default function LangSwitcher() {
  const locale = useLocale();
  const t = useTranslations("common");
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label={t("language")}
      className="min-h-10 rounded-lg border border-stone-300 bg-white px-2 text-sm"
      value={locale}
      disabled={pending}
      onChange={(e) => startTransition(() => setLocale(e.target.value))}
    >
      {locales.map((l) => (
        <option key={l} value={l}>
          {localeNames[l]}
        </option>
      ))}
    </select>
  );
}
