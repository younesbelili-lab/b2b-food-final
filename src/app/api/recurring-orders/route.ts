import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";
import {
  createRecurringOrder,
  ensureClientUserByEmail,
  listRecurringOrdersByUser,
  setRecurringOrderStatus,
} from "@/lib/store";

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
  return NextResponse.json({ items: await listRecurringOrdersByUser(user.id) });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getClientSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentification client requise." }, { status: 401 });
    }
    const body = await request.json();
    const recurring = await createRecurringOrder({
      userId: user.id,
      frequency: body.frequency,
      nextRunAt: body.nextRunAt,
      deliveryAddress: body.deliveryAddress,
      paymentMethod: body.paymentMethod,
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
    const user = await getClientSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentification client requise." }, { status: 401 });
    }
    const body = await request.json();
    const item = await setRecurringOrderStatus(body.id, body.active);
    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur mise a jour recurrence." },
      { status: 400 },
    );
  }
}
