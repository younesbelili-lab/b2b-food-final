export type Product = {
  id: string;
  name: string;
  description: string;
  category: "Fruits" | "Legumes" | "Viandes" | "Boissons";
  subcategory?:
    | "Volailles"
    | "Viandes blanches"
    | "Viandes rouges"
    | "Eau"
    | "Jus"
    | "Soda";
  origin: string;
  pricingUnit: "piece" | "kilo";
  image: string;
  priceHt: number;
  buyPriceHt: number;
  tvaRate: number;
  stock: number;
  isFeatured: boolean;
  isSlowMover: boolean;
  promoPercent?: number;
};

export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function priceTtc(priceHt: number, tvaRate: number): number {
  return roundToCents(priceHt * (1 + tvaRate / 100));
}

export function promoPriceHt(priceHt: number, promoPercent?: number): number {
  if (!promoPercent || promoPercent <= 0) {
    return priceHt;
  }

  return roundToCents(priceHt * (1 - promoPercent / 100));
}

export function marginEuro(
  sellPriceHt: number,
  buyPriceHt: number,
  quantity = 1,
): number {
  return roundToCents((sellPriceHt - buyPriceHt) * quantity);
}

export function marginPercent(sellPriceHt: number, buyPriceHt: number): number {
  if (sellPriceHt <= 0) {
    return 0;
  }

  return roundToCents(((sellPriceHt - buyPriceHt) / sellPriceHt) * 100);
}
