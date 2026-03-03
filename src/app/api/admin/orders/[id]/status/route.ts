import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/security";
import { updateOrderStatus, type OrderStatus } from "@/lib/store";

type Params = Promise<{ id: string }>;

export async function PATCH(
  request: NextRequest,
  context: { params: Params },
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Acces admin refuse." }, { status: 403 });
  }
  try {
    const params = await context.params;
    const body = await request.json();
    const order = await updateOrderStatus(params.id, body.status as OrderStatus);
    return NextResponse.json({ item: order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur mise a jour statut." },
      { status: 400 },
    );
  }
}
