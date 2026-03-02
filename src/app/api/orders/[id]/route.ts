import { NextRequest, NextResponse } from "next/server";
import { confirmReception, getOrderById } from "@/lib/store";

type Params = Promise<{ id: string }>;

export async function GET(_: NextRequest, context: { params: Params }) {
  const params = await context.params;
  const order = getOrderById(params.id);
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }
  return NextResponse.json({ item: order });
}

export async function PATCH(request: NextRequest, context: { params: Params }) {
  const params = await context.params;
  const body = await request.json();

  if (body.action === "confirmReception") {
    try {
      const order = confirmReception(params.id);
      return NextResponse.json({ item: order });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Erreur reception." },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ error: "Action non supportee." }, { status: 400 });
}
