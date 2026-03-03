type SearchParams = Promise<{ error?: string; registered?: string; message?: string; email?: string }>;

export default async function ClientLoginPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const hasError = searchParams.error === "login";
  const registerError = searchParams.error === "register";
  const isRegistered = searchParams.registered === "1";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold">Identification Client</h1>
          {hasError && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Identifiants invalides.
            </p>
          )}
          {isRegistered && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Compte cree. Connecte-toi avec ton email et ton mot de passe.
            </p>
          )}
          <form action="/api/auth/login" method="post" className="mt-4 grid gap-3">
            <input type="hidden" name="role" value="CLIENT" />
            <label className="text-sm font-medium text-slate-700">
              Email
              <input
                name="email"
                type="email"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Mot de passe
              <input
                name="password"
                type="password"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="mt-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Se connecter
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-bold">Creation compte client</h2>
          {registerError && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {searchParams.message ?? "Impossible de creer le compte."}
            </p>
          )}
          <form action="/api/auth/register-client" method="post" className="mt-4 grid gap-3">
            <label className="text-sm font-medium text-slate-700">
              Nom de l&apos;entreprise
              <input
                name="companyName"
                type="text"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Adresse email
              <input
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Numero de telephone
              <input
                name="phone"
                type="tel"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Adresse de livraison
              <textarea
                name="address"
                required
                rows={3}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Mot de passe
              <input
                name="password"
                type="password"
                minLength={6}
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="mt-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Creer le compte client
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
