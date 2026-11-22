import { getTranslations } from "next-intl/server";
import AuthForm from "@/components/AuthForm";
import Header from "@/components/Header";

export default async function SignupPage() {
  const t = await getTranslations("common");
  return (
    <>
      <Header home="/" />
      <main className="mx-auto max-w-md p-4">
        <p className="my-6 text-center text-stone-500">{t("tagline")}</p>
        <AuthForm mode="signup" />
      </main>
    </>
  );
}
