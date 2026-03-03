import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckoutWorkflow } from "@/components/checkout-workflow";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Commander | So Food Service",
  description:
    "Passage de commande B2B avec paiement immediat obligatoire, livraison planifiee et recurrence.",
};

export default async function CommanderPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  const session = verifySessionToken(token);

  if (!session) {
    redirect("/login/client");
  }

  if (session.role !== "CLIENT") {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <Suspense fallback={<div className="px-6 py-10 text-sm text-slate-600">Chargement...</div>}>
        <CheckoutWorkflow />
      </Suspense>
    </main>
  );
}
