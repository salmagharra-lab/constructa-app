import { getTranslations } from "next-intl/server";

export default async function ErrorBanner({ code }: { code?: string }) {
  if (!code) return null;
  const t = await getTranslations("errors");
  const message = t.has(code) ? t(code) : t("generic");
  return (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 font-medium text-red-700">
      {message}
    </p>
  );
}
