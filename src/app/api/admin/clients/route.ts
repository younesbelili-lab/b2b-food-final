import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/security";
import { listClientUsers, listDeletedClientUsers } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Acces admin refuse." }, { status: 403 });
  }
  return NextResponse.json({
    items: await listClientUsers(),
    deletedItems: await listDeletedClientUsers(),
  });
}
