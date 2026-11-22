import { getTranslations } from "next-intl/server";

// Placeholder contact details (not real). Replace with the team's real email and phone.
const CONTACT_EMAIL = "contact@constructa.test";
const CONTACT_PHONE_DISPLAY = "03-0000000";
const CONTACT_PHONE_TEL = "+97230000000";

export default async function ContactSection() {
  const t = await getTranslations("contact");
  return (
    <section aria-labelledby="contact-heading" className="card mt-6 text-start">
      <h2 id="contact-heading" className="text-lg font-bold">{t("title")}</h2>
      <p className="mt-1 text-stone-600">{t("body")}</p>
      <ul className="mt-3 space-y-1 text-stone-700">
        <li>
          {t("email")}:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr" className="font-medium underline">
            {CONTACT_EMAIL}
          </a>
        </li>
        <li>
          {t("phone")}:{" "}
          <a href={`tel:${CONTACT_PHONE_TEL}`} dir="ltr" className="font-medium underline">
            {CONTACT_PHONE_DISPLAY}
          </a>
        </li>
      </ul>
    </section>
  );
}
