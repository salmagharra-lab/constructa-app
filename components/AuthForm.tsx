"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { setLocale } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { isLocale, localeNames, locales } from "@/lib/i18n";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const t = useTranslations("auth");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    const supabase = createClient();

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) {
          setError(t("loginError"));
          return;
        }
        const { data: profile } = await supabase.from("profiles").select("language").eq("id", data.user.id).single();
        if (profile && isLocale(profile.language) && profile.language !== locale) await setLocale(profile.language);
      } else {
        const language = String(form.get("language"));
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: String(form.get("full_name")).trim(), role: String(form.get("role")), language },
          },
        });
        if (error) {
          setError(error.message);
          return;
        }
        if (isLocale(language) && language !== locale) await setLocale(language);
        if (!data.session) {
          setInfo(t("checkEmail"));
          return;
        }
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError(te("generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <h1 className="text-2xl font-bold">{mode === "login" ? t("login") : t("signup")}</h1>
      {mode === "signup" && (
        <div>
          <label className="label" htmlFor="full_name">
            {t("fullName")}
          </label>
          <input id="full_name" name="full_name" required className="input" autoComplete="name" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">
          {t("email")}
        </label>
        <input id="email" name="email" type="email" required dir="ltr" className="input" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          dir="ltr"
          className="input"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        {mode === "signup" && <p className="mt-1 text-xs text-stone-500">{t("passwordHint")}</p>}
      </div>
      {mode === "signup" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="role">
              {t("role")}
            </label>
            <select id="role" name="role" className="input" defaultValue="worker">
              <option value="worker">{t("roleWorker")}</option>
              <option value="manager">{t("roleManager")}</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="language">
              🌐
            </label>
            <select id="language" name="language" className="input" defaultValue={locale}>
              {locales.map((l) => (
                <option key={l} value={l}>
                  {localeNames[l]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {info && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{info}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {mode === "login" ? t("login") : t("signup")}
      </button>
      <Link href={mode === "login" ? "/signup" : "/login"} className="block text-center text-sm text-amber-700 underline">
        {mode === "login" ? t("noAccount") : t("haveAccount")}
      </Link>
    </form>
  );
}
