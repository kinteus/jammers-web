import { NextResponse } from "next/server";

import { isDatabaseAvailable } from "@/server/database-health";

export async function GET() {
  const databaseAvailable = await isDatabaseAvailable();

  return NextResponse.json({
    status: databaseAvailable ? "ok" : "degraded",
    databaseAvailable,
    service: "jammers-web",
    timestamp: new Date().toISOString(),
  }, {
    status: databaseAvailable ? 200 : 503,
  });
}
