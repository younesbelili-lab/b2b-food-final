import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? "local",
    project: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "unknown",
    now: new Date().toISOString(),
  });
}
