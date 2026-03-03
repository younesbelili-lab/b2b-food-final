import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";
import { clientOverview, ensureClientUserByEmail } from "@/lib/store";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const session = verifySessionToken(token);
  if (!session || session.role !== "CLIENT") {
    return NextResponse.json({ error: "Authentification client requise." }, { status: 401 });
  }
  const user = await ensureClientUserByEmail(session.email);
  return NextResponse.json({ item: await clientOverview(user.id) });
}
