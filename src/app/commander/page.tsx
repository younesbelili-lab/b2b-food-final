import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutWorkflow } from "@/components/checkout-workflow";

export const metadata: Metadata = {
  title: "Commander | So Food Service",
  description:
    "Passage de commande B2B avec paiement immediat obligatoire, livraison planifiee et recurrence.",
};

export default function CommanderPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Suspense fallback={<div className="px-6 py-10 text-sm text-slate-600">Chargement...</div>}>
        <CheckoutWorkflow />
      </Suspense>
    </main>
  );
}
