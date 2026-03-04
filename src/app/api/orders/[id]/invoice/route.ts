import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@/lib/store";
import { createSimplePdf } from "@/lib/pdf";

type Params = Promise<{ id: string }>;

export async function GET(_: NextRequest, context: { params: Params }) {
  const params = await context.params;
  const order = await getOrderById(params.id);
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }

  const lines = order.lines
    .map(
      (line) =>
        `- ${line.productName} x${line.quantity} | HT ${line.lineTotalHt.toFixed(2)} EUR | TTC ${line.lineTotalTtc.toFixed(2)} EUR`,
    )
    .join(" | ");
  const pdf = createSimplePdf([
    `FACTURE ${order.invoiceNumber}`,
    `Commande: ${order.id}`,
    `Date: ${order.createdAt}`,
    `Livraison: ${order.deliveryDate}`,
    `Adresse livraison: ${order.deliveryAddress ?? ""}`,
    `Articles: ${lines}`,
    `Total HT: ${order.totalHt.toFixed(2)} EUR`,
    `TVA: ${order.totalTva.toFixed(2)} EUR`,
    `Total TTC: ${order.totalTtc.toFixed(2)} EUR`,
  ]);

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.invoiceNumber}.pdf"`,
    },
  });
}
