"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

type Product = {
  id: string;
  name: string;
  category: string;
  origin: string;
  pricingUnit: "piece" | "kilo";
  image: string;
  priceHt: number;
  tvaRate: number;
  promoPercent?: number;
};

type CheckoutOrder = {
  id: string;
  invoiceNumber: string;
  totalTtc: number;
  status: string;
};

type ClientOverview = {
  totalOrders: number;
  ongoingOrders: number;
  pastOrders: number;
  frequentItems: Array<{
    productId: string;
    productName: string;
    quantity: number;
  }>;
};

const paymentMethods = [
  { value: "CARD", label: "Carte bancaire" },
  { value: "APPLE_PAY", label: "Apple Pay" },
  { value: "GOOGLE_PAY", label: "Google Pay" },
  { value: "OPEN_BANKING", label: "Virement instantane / Open Banking" },
] as const;

const frequencies = [
  { value: "DAILY", label: "Quotidienne" },
  { value: "WEEKLY", label: "Hebdomadaire" },
  { value: "MONTHLY", label: "Mensuelle" },
] as const;

function categoryAccent(category: string) {
  if (category === "Fruits") {
    return "from-orange-200 to-rose-200";
  }
  if (category === "Legumes") {
    return "from-emerald-200 to-lime-200";
  }
  if (category === "Viandes") {
    return "from-rose-200 to-red-300";
  }
  return "from-sky-200 to-blue-300";
}

function getMinDeliveryDateIso(now = new Date()): string {
  const cutoff = new Date(now);
  cutoff.setHours(19, 0, 0, 0);
  const days = now <= cutoff ? 1 : 2;
  const delivery = new Date(now);
  delivery.setDate(now.getDate() + days);
  return delivery.toISOString().split("T")[0];
}

export function CheckoutWorkflow() {
  const searchParams = useSearchParams();
  const fromCatalogue = Boolean(searchParams.get("cart"));
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [deliveryDate, setDeliveryDate] = useState(getMinDeliveryDateIso());
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]["value"]>("CARD");
  const [recurringFrequency, setRecurringFrequency] = useState<(typeof frequencies)[number]["value"]>("WEEKLY");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<CheckoutOrder | null>(null);
  const [recurringInfo, setRecurringInfo] = useState("");
  const [overview, setOverview] = useState<ClientOverview | null>(null);
  const [cartLoaded, setCartLoaded] = useState(false);

  async function loadOverview() {
    const response = await fetch("/api/client/overview");
    const data = await response.json();
    setOverview(data.item ?? null);
  }

  useEffect(() => {
    void Promise.all([
      fetch("/api/products")
        .then((res) => res.json())
        .then((data) => setProducts(data.items ?? [])),
      loadOverview(),
      fetch("/api/client/profile")
        .then((res) => res.json())
        .then((data) => setDeliveryAddress(data.item?.address ?? "")),
    ]);
  }, []);

  useEffect(() => {
    if (!products.length || cartLoaded) {
      return;
    }

    const cart = searchParams.get("cart");
    if (!cart) {
      setCartLoaded(true);
      return;
    }

    const nextQuantities: Record<string, number> = {};
    for (const chunk of cart.split(",")) {
      const [productId, quantityRaw] = chunk.split(":");
      const quantity = Number(quantityRaw);
      if (!productId || Number.isNaN(quantity) || quantity <= 0) {
        continue;
      }
      if (products.some((product) => product.id === productId)) {
        nextQuantities[productId] = Math.floor(quantity);
      }
    }

    setQuantities((prev) => ({ ...prev, ...nextQuantities }));
    setCartLoaded(true);
  }, [products, searchParams, cartLoaded]);

  const cartLines = products
    .map((product) => ({
      productId: product.id,
      quantity: quantities[product.id] ?? 0,
      priceTtc:
        product.priceHt *
        (1 - ((product.promoPercent ?? 0) / 100)) *
        (1 + product.tvaRate / 100),
      name: product.name,
    }))
    .filter((line) => line.quantity > 0);

  const totalTtc = cartLines.reduce(
    (sum, line) => sum + line.quantity * line.priceTtc,
    0,
  );

  async function submitCheckout() {
    setLoading(true);
    setError("");
    setSuccess(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: cartLines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
          paymentMethod,
          deliveryDate,
          deliveryAddress,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Erreur checkout.");
      }
      setSuccess(data.order);
      setQuantities({});
      await loadOverview();
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Erreur checkout.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function createRecurring() {
    setRecurringInfo("");
    const nextRunAt = `${deliveryDate}T08:00:00.000Z`;
    const response = await fetch("/api/recurring-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        frequency: recurringFrequency,
        nextRunAt,
        lines: cartLines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setRecurringInfo(data.error ?? "Erreur recurrence.");
      return;
    }
    setRecurringInfo(`Commande recurrente creee: ${data.item.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      {overview && (
        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Commandes en cours</p>
            <p className="mt-1 text-3xl font-bold">{overview.ongoingOrders}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Commandes passees</p>
            <p className="mt-1 text-3xl font-bold">{overview.pastOrders}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total commandes</p>
            <p className="mt-1 text-3xl font-bold">{overview.totalOrders}</p>
          </article>
        </section>
      )}

      {overview && overview.frequentItems.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Articles souvent achetes</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {overview.frequentItems.map((item) => (
              <span
                key={item.productId}
                className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700"
              >
                {item.productName} ({item.quantity})
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold">Commander</h1>
        <p className="mt-2 text-sm text-slate-600">
          Paiement immediat obligatoire. La commande est creee uniquement apres validation du paiement.
        </p>
        {fromCatalogue && (
          <div className="mt-4">
            <Link
              href="/catalogue"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
            >
              Retour au catalogue
            </Link>
          </div>
        )}
      </section>

      {fromCatalogue ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Votre panier</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Article</th>
                  <th className="px-3 py-2 text-right font-semibold">Quantite</th>
                  <th className="px-3 py-2 text-right font-semibold">Sous-total</th>
                </tr>
              </thead>
              <tbody>
                {cartLines.map((line) => (
                  <tr key={line.productId} className="border-t border-slate-200">
                    <td className="px-3 py-2">{line.name}</td>
                    <td className="px-3 py-2 text-right">{line.quantity}</td>
                    <td className="px-3 py-2 text-right">
                      {(line.quantity * line.priceTtc).toFixed(2)} EUR
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cartLines.length === 0 && (
            <p className="mt-3 text-sm text-slate-600">
              Votre panier est vide. Retournez au catalogue pour ajouter des articles.
            </p>
          )}
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {products.map((product) => (
            <article key={product.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className={`h-36 w-full bg-gradient-to-br ${categoryAccent(product.category)}`}>
                <Image
                  src={product.image}
                  alt={product.name}
                  width={1200}
                  height={800}
                  unoptimized
                  className="h-36 w-full object-contain p-2"
                />
              </div>
              <div className="p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {product.category}
              </p>
              <h2 className="text-lg font-semibold">{product.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Origine: {product.origin} | Prix par {product.pricingUnit === "piece" ? "piece" : "kilo"}
              </p>
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Quantite
                <input
                  type="number"
                  min={0}
                  value={quantities[product.id] ?? 0}
                  onChange={(event) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [product.id]: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">Paiement et livraison</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Date de livraison
            <input
              type="date"
              min={getMinDeliveryDateIso()}
              value={deliveryDate}
              onChange={(event) => setDeliveryDate(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Moyen de paiement
            <select
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(
                  event.target.value as (typeof paymentMethods)[number]["value"],
                )
              }
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            >
              {paymentMethods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Adresse de livraison
          <textarea
            rows={3}
            value={deliveryAddress}
            onChange={(event) => setDeliveryAddress(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <p className="mt-4 text-lg font-semibold">
          Total estime TTC: {totalTtc.toFixed(2)} EUR
        </p>
        <button
          type="button"
          onClick={submitCheckout}
          disabled={loading || cartLines.length === 0 || !deliveryAddress.trim()}
          className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:bg-slate-400"
        >
          {loading ? "Paiement en cours..." : "Payer et creer la commande"}
        </button>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <h3 className="font-semibold">Commande recurrente</h3>
          <div className="mt-2 flex flex-wrap gap-3">
            <select
              value={recurringFrequency}
              onChange={(event) =>
                setRecurringFrequency(
                  event.target.value as (typeof frequencies)[number]["value"],
                )
              }
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {frequencies.map((frequency) => (
                <option key={frequency.value} value={frequency.value}>
                  {frequency.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={createRecurring}
              disabled={cartLines.length === 0}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              Enregistrer recurrence
            </button>
          </div>
          {recurringInfo && <p className="mt-2 text-sm text-slate-600">{recurringInfo}</p>}
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        {success && (
          <div className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
            <p>Commande creee: {success.id}</p>
            <p>Facture: {success.invoiceNumber}</p>
            <p>Total TTC: {success.totalTtc.toFixed(2)} EUR</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link href={`/api/orders/${success.id}/invoice`} className="underline">
                Telecharger la facture
              </Link>
              <Link href="/historique" className="underline">
                Voir l&apos;historique
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
