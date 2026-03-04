import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";
import { cancelOrder, confirmReception, getOrderById, updateOrder } from "@/lib/store";

type Params = Promise<{ id: string }>;

export async function GET(_: NextRequest, context: { params: Params }) {
  const params = await context.params;
  const order = await getOrderById(params.id);
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }
  return NextResponse.json({ item: order });
}

export async function PATCH(request: NextRequest, context: { params: Params }) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  const params = await context.params;
  const body = await request.json();

  if (body.action === "confirmReception") {
    try {
      const order = await confirmReception(params.id);
      return NextResponse.json({ item: order });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Erreur reception." },
        { status: 400 },
      );
    }
  }

  if (body.action === "updateOrder") {
    try {
      const order = await updateOrder(
        params.id,
        { role: session.role, email: session.email },
        {
          deliveryDate: typeof body.deliveryDate === "string" ? body.deliveryDate : undefined,
          deliveryAddress:
            typeof body.deliveryAddress === "string" ? body.deliveryAddress : undefined,
        },
      );
      return NextResponse.json({ item: order });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Erreur modification commande." },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ error: "Action non supportee." }, { status: 400 });
}

export async function DELETE(request: NextRequest, context: { params: Params }) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }
  try {
    const params = await context.params;
    const order = await cancelOrder(params.id, { role: session.role, email: session.email });
    return NextResponse.json({ item: order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur annulation commande." },
      { status: 400 },
    );
  }
}
