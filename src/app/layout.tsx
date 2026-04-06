import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/current-user";
import { env } from "@/lib/env";
import { getLocale } from "@/lib/i18n-server";

import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: {
    default: "The Jammers",
    template: "%s | The Jammers",
  },
  description: "Live gig boards for The Jammers: propose songs, build line-ups, publish setlists, and coordinate musicians through Telegram.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "The Jammers",
    url: "/",
    title: "The Jammers",
    description:
      "Live gig boards for The Jammers: propose songs, build line-ups, publish setlists, and coordinate musicians through Telegram.",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Jammers",
    description:
      "Live gig boards for The Jammers: propose songs, build line-ups, publish setlists, and coordinate musicians through Telegram.",
  },
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
