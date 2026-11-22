import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { dirFor } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "CONSTRUCTA",
  description: "Attendance and daily tasks for construction sites",
  appleWebApp: { capable: true, title: "CONSTRUCTA", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f59e0b",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} dir={dirFor(locale)}>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
