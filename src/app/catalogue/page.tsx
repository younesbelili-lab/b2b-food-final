import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  CatalogueExperience,
  type CatalogueProduct,
} from "@/components/catalogue-experience";
import { LogoutButton } from "@/components/logout-button";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";
import { listProducts } from "@/lib/store";

export const metadata: Metadata = {
  title: "Catalogue B2B | So Food Service",
  description:
    "Catalogue avec images produits, selection rapide des quantites et passage de commande direct.",
};

export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  const session = verifySessionToken(token);
  const pageTitle = session?.role === "ADMIN" ? "Administration" : "Catalogue";

  const products: CatalogueProduct[] = (await listProducts())
    .filter((product) => product.stock > 0)
    .map((product) => ({
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

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Catalogue So Food Service",
    itemListElement: products.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: product.name,
    })),
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">{pageTitle}</h1>
          <div className="flex items-center gap-2">
            <LogoutButton initialRole={session?.role === "ADMIN" ? "ADMIN" : "CLIENT"} />
          </div>
        </div>
        <CatalogueExperience products={products} />
      </div>
    </main>
  );
}
