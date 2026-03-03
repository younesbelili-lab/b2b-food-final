import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";
import {
  ensureClientUserByEmail,
  listOrdersByUser,
  listRecurringOrdersByUser,
} from "@/lib/store";

export const metadata: Metadata = {
  title: "Historique | So Food Service",
  description: "Historique des commandes, factures et commandes recurrentes.",
};

export default async function HistoriquePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  const session = verifySessionToken(token);

  if (!session || session.role !== "CLIENT") {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <div className="mx-auto w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold">Historique client</h1>
          <p className="mt-2 text-sm text-slate-600">
            Connecte-toi avec un compte client pour voir ton historique.
          </p>
          <Link href="/login/client" className="mt-4 inline-block underline">
            Aller a la connexion client
          </Link>
        </div>
      </main>
    );
  }

  const user = await ensureClientUserByEmail(session.email);
  const orders = await listOrdersByUser(user.id);
  const recurring = await listRecurringOrdersByUser(user.id);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-3xl font-bold">Historique client</h1>
          <p className="mt-2 text-sm text-slate-600">{user.companyName}</p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold">Commandes</h2>
          <div className="mt-4 space-y-3">
            {orders.map((order) => (
              <article key={order.id} className="rounded-lg border border-slate-200 p-4">
                <p className="font-semibold">{order.id}</p>
                <p className="text-sm text-slate-600">Statut: {order.status}</p>
                <p className="text-sm text-slate-600">
                  Total TTC: {order.totalTtc.toFixed(2)} EUR
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  <Link href={`/api/orders/${order.id}/invoice`} className="underline">
                    Facture
                  </Link>
                  <Link href={`/api/orders/${order.id}`} className="underline">
                    Detail JSON
                  </Link>
                </div>
              </article>
            ))}
            {orders.length === 0 && (
              <p className="text-sm text-slate-600">Aucune commande pour le moment.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold">Commandes recurrentes</h2>
          <div className="mt-4 space-y-3">
            {recurring.map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-200 p-4 text-sm">
                <p className="font-semibold">{item.id}</p>
                <p>Frequence: {item.frequency}</p>
                <p>Active: {item.active ? "Oui" : "Non"}</p>
                <p>Prochaine execution: {item.nextRunAt}</p>
              </article>
            ))}
            {recurring.length === 0 && (
              <p className="text-sm text-slate-600">
                Aucune commande recurrente configuree.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
