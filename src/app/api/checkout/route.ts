import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";
import {
  createRecurringOrder,
  createCheckout,
  ensureClientUserByEmail,
  type OrderRecurrence,
  type PaymentMethod,
} from "@/lib/store";

function nextRunAtFromDelivery(deliveryDate: string, recurrence: Exclude<OrderRecurrence, "NONE">) {
  const runAt = new Date(`${deliveryDate}T08:00:00.000Z`);
  if (Number.isNaN(runAt.getTime())) {
    return new Date().toISOString();
  }
  if (recurrence === "DAILY") {
    runAt.setUTCDate(runAt.getUTCDate() + 1);
  } else if (recurrence === "WEEKLY") {
    runAt.setUTCDate(runAt.getUTCDate() + 7);
  } else {
    runAt.setUTCMonth(runAt.getUTCMonth() + 1);
  }
  return runAt.toISOString();
}

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

    const recurringFrequency =
      body.recurringFrequency === "DAILY" ||
      body.recurringFrequency === "WEEKLY" ||
      body.recurringFrequency === "MONTHLY"
        ? body.recurringFrequency
        : "NONE";

    let recurringOrderId: string | undefined;
    if (recurringFrequency !== "NONE") {
      const recurring = await createRecurringOrder({
        userId: user.id,
        frequency: recurringFrequency,
        nextRunAt: nextRunAtFromDelivery(body.deliveryDate, recurringFrequency),
        deliveryAddress: String(body.deliveryAddress ?? user.address ?? "").trim(),
        paymentMethod,
        lines: body.lines ?? [],
      });
      recurringOrderId = recurring.id;
    }

    const order = await createCheckout({
      userId: user.id,
      lines: body.lines ?? [],
      paymentMethod,
      deliveryDate: body.deliveryDate,
      deliveryAddress: String(body.deliveryAddress ?? user.address ?? "").trim(),
      recurrence: recurringFrequency,
      recurringOrderId,
    });

    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur checkout." },
      { status: 400 },
    );
  }
}
