import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";
import { createTicket, ensureClientUserByEmail, listTicketsByUser } from "@/lib/store";

async function getClientSessionUser(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const session = verifySessionToken(token);
  if (!session || session.role !== "CLIENT") {
    return null;
  }
  return await ensureClientUserByEmail(session.email);
}

export async function GET(request: NextRequest) {
  const user = await getClientSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Authentification client requise." }, { status: 401 });
  }
  return NextResponse.json({ items: await listTicketsByUser(user.id) });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getClientSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentification client requise." }, { status: 401 });
    }
    const body = await request.json();
    const ticket = await createTicket({
      userId: user.id,
      subject: body.subject,
      message: body.message,
    });
    return NextResponse.json({ item: ticket }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur creation ticket." },
      { status: 400 },
    );
  }
}
