import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/auth/current-user";

import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: "Jammers Setlist",
  description: "Public concert setlist planning board with Telegram sign-in.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <SiteHeader user={user} />
        <main className="mx-auto min-h-[calc(100vh-73px)] max-w-7xl px-6 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
