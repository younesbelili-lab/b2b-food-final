import { NextRequest, NextResponse } from "next/server";
import { createBackup, listBackups } from "@/lib/store";
import { isAdminRequest } from "@/lib/security";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Acces admin refuse." }, { status: 403 });
  }
  return NextResponse.json({ items: await listBackups() });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Acces admin refuse." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const { backup, snapshot } = await createBackup(body.reason ?? "manual");
  return new NextResponse(snapshot, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${backup.id}.json"`,
      "x-backup-id": backup.id,
    },
  });
}
