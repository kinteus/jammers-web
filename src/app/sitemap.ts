import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL;
  let events: Array<{ slug: string; updatedAt: Date }> = [];

  try {
    events = await db.event.findMany({
      select: {
        slug: true,
        updatedAt: true,
      },
      orderBy: {
        startsAt: "desc",
      },
    });
  } catch {
    // Keep the route available during CI builds where DATABASE_URL is intentionally unreachable.
  }

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...events.map((event) => ({
      url: `${baseUrl}/events/${event.slug}`,
      lastModified: event.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
