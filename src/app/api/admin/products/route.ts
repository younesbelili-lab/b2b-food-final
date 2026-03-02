import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/security";
import { addAdminProduct, listProducts } from "@/lib/store";

export function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Acces admin refuse." }, { status: 403 });
  }
  return NextResponse.json({ items: listProducts() });
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Acces admin refuse." }, { status: 403 });
  }
  try {
    const body = await request.json();
    const product = addAdminProduct({
      name: body.name,
      origin: body.origin,
      category: body.category,
      subcategory: body.subcategory,
      pricingUnit: body.pricingUnit,
      priceHt: Number(body.priceHt),
      buyPriceHt: body.buyPriceHt ? Number(body.buyPriceHt) : undefined,
      tvaRate: body.tvaRate ? Number(body.tvaRate) : undefined,
      stock: body.stock ? Number(body.stock) : undefined,
      description: body.description,
      image: body.image,
    });
    return NextResponse.json({ item: product }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur creation produit." },
      { status: 400 },
    );
  }
}
