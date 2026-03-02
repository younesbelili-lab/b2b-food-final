"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function SiteAuthPanel() {
  const router = useRouter();
  const [role, setRole] = useState<"CLIENT" | "ADMIN">("CLIENT");
  const [email, setEmail] = useState("client@sofoodservice.local");
  const [password, setPassword] = useState("client123");
  const [authenticated, setAuthenticated] = useState(false);
  const [currentRole, setCurrentRole] = useState<"CLIENT" | "ADMIN" | "">("");
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/auth/session");
      const data = await response.json();
      if (data.authenticated) {
        setAuthenticated(true);
        setCurrentRole(data.role);
      }
    })();
  }, []);

  function chooseRole(nextRole: "CLIENT" | "ADMIN") {
    setRole(nextRole);
    if (nextRole === "ADMIN") {
      setEmail("admin@sofoodservice.local");
      setPassword("admin123");
    } else {
      setEmail("client@sofoodservice.local");
      setPassword("client123");
    }
  }

  async function login() {
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, email: email.trim(), password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? "Echec connexion.");
      return;
    }
    setAuthenticated(true);
    setCurrentRole(data.role);
    router.push("/catalogue");
    router.refresh();
  }

  async function logout() {
    const redirectPath = currentRole === "ADMIN" ? "/login/admin" : "/login/client";
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
    setCurrentRole("");
    router.push(redirectPath);
    router.refresh();
  }

  if (authenticated) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-700">
            Connecte en tant que <span className="font-semibold">{currentRole}</span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/catalogue")}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Aller au catalogue
            </button>
            {currentRole === "ADMIN" && (
              <button
                type="button"
                onClick={() => router.push("/admin")}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
              >
                Espace admin
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              Deconnexion
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">Connexion unique</h2>
      <p className="mt-1 text-sm text-slate-600">
        Un seul lien pour tous: connecte-toi en client ou en admin.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => chooseRole("CLIENT")}
          className={
            role === "CLIENT"
              ? "rounded-full bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white"
              : "rounded-full border border-slate-300 px-3 py-1.5 text-sm"
          }
        >
          Client
        </button>
        <button
          type="button"
          onClick={() => chooseRole("ADMIN")}
          className={
            role === "ADMIN"
              ? "rounded-full bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white"
              : "rounded-full border border-slate-300 px-3 py-1.5 text-sm"
          }
        >
          Admin
        </button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mot de passe"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={login}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Se connecter
        </button>
        {error && <p className="text-sm text-rose-700">{error}</p>}
      </div>
    </section>
  );
}
