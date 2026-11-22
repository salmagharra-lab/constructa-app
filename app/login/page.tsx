import { getTranslations } from "next-intl/server";
import AuthForm from "@/components/AuthForm";
import Header from "@/components/Header";

export default async function LoginPage() {
  const t = await getTranslations("common");
  return (
    <>
      <Header home="/" />
      <main className="mx-auto max-w-md p-4">
        <h1 className="mt-6 text-center text-2xl font-bold">{t("greeting")}</h1>
        <p className="mb-6 mt-2 text-center text-stone-500">{t("tagline")}</p>
        <AuthForm mode="login" />
      </main>
    </>
  );
}
