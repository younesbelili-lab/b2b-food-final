import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";
import { getUserByEmail } from "@/lib/store";

export function GET(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const session = verifySessionToken(token);
  if (!session || session.role !== "CLIENT") {
    return NextResponse.json({ error: "Authentification client requise." }, { status: 401 });
  }
  const user = getUserByEmail(session.email);
  if (!user || user.role !== "CLIENT") {
    return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
  }
  return NextResponse.json({
    item: {
      id: user.id,
      companyName: user.companyName,
      email: user.email,
      phone: user.phone,
      address: user.address,
    },
  });
}
