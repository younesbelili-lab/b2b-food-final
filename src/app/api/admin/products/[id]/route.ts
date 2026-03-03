import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/security";
import { deleteAdminProduct, updateAdminProduct } from "@/lib/store";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, context: Context) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Acces admin refuse." }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const body = await request.json();
    const product = await updateAdminProduct(id, {
      name: body.name,
      origin: body.origin,
      category: body.category,
      subcategory: body.subcategory,
      pricingUnit: body.pricingUnit,
      priceHt: body.priceHt !== undefined ? Number(body.priceHt) : undefined,
      buyPriceHt: body.buyPriceHt !== undefined ? Number(body.buyPriceHt) : undefined,
      tvaRate: body.tvaRate !== undefined ? Number(body.tvaRate) : undefined,
      stock: body.stock !== undefined ? Number(body.stock) : undefined,
      description: body.description,
      image: body.image,
      isFeatured: body.isFeatured,
      isSlowMover: body.isSlowMover,
      promoPercent: body.promoPercent !== undefined ? Number(body.promoPercent) : undefined,
    });
    return NextResponse.json({ item: product });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur modification produit." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Acces admin refuse." }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const product = await deleteAdminProduct(id);
    return NextResponse.json({ item: product });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur suppression produit." },
      { status: 400 },
    );
  }
}
