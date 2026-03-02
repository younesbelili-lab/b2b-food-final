import { NextRequest, NextResponse } from "next/server";
import {
  getSessionCookieName,
  verifySessionToken,
} from "@/lib/auth";
import {
  getUserByEmail,
  getUserById,
  listAllOrders,
  listAllRecurringOrders,
  listOrdersByUser,
  listRecurringOrdersByUser,
} from "@/lib/store";

export function GET(request: NextRequest) {
  const token = request.cookies.get(getSessionCookieName())?.value;
  const session = verifySessionToken(token);
  if (!session) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  if (session.role === "ADMIN") {
    const orders = listAllOrders()
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((order) => {
      const user = getUserById(order.userId);
      return {
        ...order,
        clientCompany: user?.companyName ?? "Client inconnu",
        clientEmail: user?.email ?? "",
      };
    });
    const recurringItems = listAllRecurringOrders().map((item) => {
      const user = getUserById(item.userId);
      return {
        ...item,
        clientCompany: user?.companyName ?? "Client inconnu",
        clientEmail: user?.email ?? "",
      };
    });
    return NextResponse.json({ items: orders, recurringItems });
  }

  const user = getUserByEmail(session.email);
  if (!user || user.role !== "CLIENT") {
    return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
  }
  const orders = listOrdersByUser(user.id)
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const recurringItems = listRecurringOrdersByUser(user.id);
  return NextResponse.json({ items: orders, recurringItems });
}
