import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-emerald-100 via-emerald-50 to-amber-100 p-8">
            <p className="mb-3 inline-flex rounded-full bg-emerald-700 px-3 py-1 text-sm font-semibold text-white">
              So Food Service
            </p>
            <h1 className="text-4xl font-bold">Identification</h1>
            <p className="mt-2 text-slate-700">
              Choisissez votre espace de connexion.
            </p>
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-2">
            <Link
              href="/login/client"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              <h2 className="text-xl font-semibold">Connexion Client</h2>
              <p className="mt-1 text-sm text-slate-600">
                Acces au catalogue, commande et historique.
              </p>
            </Link>
            <Link
              href="/login/admin"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-400 hover:bg-slate-100"
            >
              <h2 className="text-xl font-semibold">Connexion Admin</h2>
              <p className="mt-1 text-sm text-slate-600">
                Acces au tableau de bord, gestion produits et supervision.
              </p>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
