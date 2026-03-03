import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";
import {
  createCheckout,
  ensureClientUserByEmail,
  type PaymentMethod,
} from "@/lib/store";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(getSessionCookieName())?.value;
    const session = verifySessionToken(token);
    if (!session || session.role !== "CLIENT") {
      return NextResponse.json({ error: "Authentification client requise." }, { status: 401 });
    }

    const body = await request.json();
    const user = await ensureClientUserByEmail(session.email, {
      address: String(body.deliveryAddress ?? "").trim(),
    });
    const paymentMethod = body.paymentMethod as PaymentMethod;

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Le paiement immediat est obligatoire." },
        { status: 400 },
      );
    }

    const order = await createCheckout({
      userId: user.id,
      lines: body.lines ?? [],
      paymentMethod,
      deliveryDate: body.deliveryDate,
      deliveryAddress: String(body.deliveryAddress ?? user.address ?? "").trim(),
    });

    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur checkout." },
      { status: 400 },
    );
  }
}
