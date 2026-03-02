"use client";

import { useRouter } from "next/navigation";

export function LogoutButton({ initialRole }: { initialRole?: "ADMIN" | "CLIENT" }) {
  const router = useRouter();

  async function logout() {
    let redirectPath = initialRole === "ADMIN" ? "/login/admin" : "/login/client";
    try {
      const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json();
        redirectPath = sessionData.role === "ADMIN" ? "/login/admin" : "/login/client";
      }
    } catch {
      // keep fallback based on initial role
    }

    await fetch("/api/auth/logout", { method: "POST" });
    router.push(redirectPath);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
    >
      Deconnexion
    </button>
  );
}
