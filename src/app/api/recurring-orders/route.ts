import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";
import {
  createRecurringOrder,
  ensureClientUserByEmail,
  listRecurringOrdersByUser,
  setRecurringOrderStatus,
} from "@/lib/store";

function getClientSessionUser(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const session = verifySessionToken(token);
  if (!session || session.role !== "CLIENT") {
    return null;
  }
  return ensureClientUserByEmail(session.email);
}

export function GET(request: NextRequest) {
  const user = getClientSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Authentification client requise." }, { status: 401 });
  }
  return NextResponse.json({ items: listRecurringOrdersByUser(user.id) });
}

export async function POST(request: NextRequest) {
  try {
    const user = getClientSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentification client requise." }, { status: 401 });
    }
    const body = await request.json();
    const recurring = createRecurringOrder({
      userId: user.id,
      frequency: body.frequency,
      nextRunAt: body.nextRunAt,
      lines: body.lines ?? [],
    });
    return NextResponse.json({ item: recurring }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur creation recurrence." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = getClientSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentification client requise." }, { status: 401 });
    }
    const body = await request.json();
    const item = setRecurringOrderStatus(body.id, body.active);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur mise a jour recurrence." },
      { status: 400 },
    );
  }
}
