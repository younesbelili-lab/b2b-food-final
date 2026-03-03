import { NextRequest, NextResponse } from "next/server";
import { listStockMovements } from "@/lib/store";
import { isAdminRequest } from "@/lib/security";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Acces admin refuse." }, { status: 403 });
  }
  return NextResponse.json({ items: await listStockMovements() });
}
