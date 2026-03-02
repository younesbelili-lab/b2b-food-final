import { NextRequest, NextResponse } from "next/server";
import { listProducts } from "@/lib/store";

export function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const promotion = request.nextUrl.searchParams.get("promotion") === "1";

  const products = listProducts().filter((product) => {
    if (category && product.category !== category) {
      return false;
    }
    if (product.stock <= 0) {
      return false;
    }
    if (promotion && !product.promoPercent) {
      return false;
    }
    return true;
  });

  const publicProducts = products.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    subcategory: product.subcategory,
    origin: product.origin,
    pricingUnit: product.pricingUnit,
    image: product.image,
    priceHt: product.priceHt,
    tvaRate: product.tvaRate,
    isFeatured: product.isFeatured,
    isSlowMover: product.isSlowMover,
    promoPercent: product.promoPercent,
  }));
  return NextResponse.json({ items: publicProducts });
}
