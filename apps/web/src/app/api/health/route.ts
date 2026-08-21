import { NextResponse } from "next/server";
import type { HealthCheckResult } from "@lead-radar/types";

export async function GET() {
  const result: HealthCheckResult = {
    status: "ok",
    service: "web",
    timestamp: new Date().toISOString(),
    checks: {},
  };
  return NextResponse.json(result);
}
