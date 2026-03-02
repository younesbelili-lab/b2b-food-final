import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/security";
import { listClientUsers, listDeletedClientUsers } from "@/lib/store";

export function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Acces admin refuse." }, { status: 403 });
  }
  return NextResponse.json({
    items: listClientUsers(),
    deletedItems: listDeletedClientUsers(),
  });
}
