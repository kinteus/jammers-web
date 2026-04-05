import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getLocale } from "@/lib/i18n-server";

import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: "The Jammers",
  description: "Public gig stage-sheet for proposing songs, building lineups and publishing setlists.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body>
        <SiteHeader locale={locale} user={user} />
        <main className="mx-auto min-h-[calc(100vh-73px)] max-w-[1440px] px-5 py-8 md:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
