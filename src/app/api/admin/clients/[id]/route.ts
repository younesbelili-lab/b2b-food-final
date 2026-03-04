import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/security";
import { deleteClientUser, getUserById, listOrdersByUser, restoreClientUser } from "@/lib/store";

type Params = Promise<{ id: string }>;

export async function GET(request: NextRequest, context: { params: Params }) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Acces admin refuse." }, { status: 403 });
  }

  const { id } = await context.params;
  const user = await getUserById(id);
  if (!user || user.role !== "CLIENT") {
    return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
  }

  const orders = (await listOrdersByUser(user.id))
    .slice()
    .sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime());
  const totalAmountTtc = orders.reduce((sum, order) => sum + order.totalTtc, 0);

  return NextResponse.json({
    item: {
      client: {
        id: user.id,
        companyName: user.companyName,
        email: user.email,
        phone: user.phone,
        address: user.address,
      },
      orders,
      totalAmountTtc,
      ordersCount: orders.length,
    },
  });
}

export async function DELETE(request: NextRequest, context: { params: Params }) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Acces admin refuse." }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const user = await deleteClientUser(id);
    return NextResponse.json({ item: user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur suppression client." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest, context: { params: Params }) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Acces admin refuse." }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    if (body?.action !== "restore") {
      return NextResponse.json({ error: "Action non supportee." }, { status: 400 });
    }
    const user = await restoreClientUser(id);
    return NextResponse.json({ item: user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur restauration client." },
      { status: 400 },
    );
  }
}
