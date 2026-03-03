import { NextResponse } from "next/server";
import { getStorageStatus } from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return NextResponse.json({ item: getStorageStatus() });
}

