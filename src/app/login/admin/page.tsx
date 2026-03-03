type SearchParams = Promise<{ error?: string }>;

export default async function AdminLoginPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const hasError = searchParams.error === "login";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-xl">
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold">Identification Admin</h1>
          {hasError && (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Identifiants invalides.
            </p>
          )}
          <form action="/api/auth/login" method="post" className="mt-4 grid gap-3">
            <input type="hidden" name="role" value="ADMIN" />
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
              className="mt-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Se connecter
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
