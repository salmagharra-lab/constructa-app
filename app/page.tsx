import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Header from "@/components/Header";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (!isSupabaseConfigured) {
    const t = await getTranslations("setup");
    const tc = await getTranslations("common");
    return (
      <>
        <Header home="/" />
        <main className="mx-auto max-w-xl p-4">
          <h1 className="mt-6 text-center text-2xl font-bold">{tc("greeting")}</h1>
          <div className="card mt-6">
            <h1 className="h2">{t("title")}</h1>
            <p className="leading-7 text-stone-700">{t("body")}</p>
          </div>
        </main>
      </>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  redirect(profile?.role === "manager" ? "/manager" : "/worker");
}
