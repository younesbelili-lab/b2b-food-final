import { NextRequest, NextResponse } from "next/server";
import {
  getSessionCookieName,
  verifySessionToken,
} from "@/lib/auth";
import {
  ensureClientUserByEmail,
  getUserById,
  listAllOrders,
  listAllRecurringOrders,
  listOrdersByUser,
  listRecurringOrdersByUser,
} from "@/lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  if (session.role === "ADMIN") {
    const ordersSource = (await listAllOrders())
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const orders = [];
    for (const order of ordersSource) {
      const user = await getUserById(order.userId);
      orders.push({
        ...order,
        clientCompany: user?.companyName ?? "Client inconnu",
        clientEmail: user?.email ?? "",
      });
    }
    const recurringSource = await listAllRecurringOrders();
    const recurringItems = [];
    for (const item of recurringSource) {
      const user = await getUserById(item.userId);
      recurringItems.push({
        ...item,
        clientCompany: user?.companyName ?? "Client inconnu",
        clientEmail: user?.email ?? "",
      });
    }
    return NextResponse.json({ items: orders, recurringItems });
  }

  const user = await ensureClientUserByEmail(session.email);
  const orders = (await listOrdersByUser(user.id))
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recurringItems = await listRecurringOrdersByUser(user.id);
  return NextResponse.json({ items: orders, recurringItems });
}
