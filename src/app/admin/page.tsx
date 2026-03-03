import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getSessionCookieName, verifySessionToken } from "@/lib/auth";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  const session = verifySessionToken(token);

  if (!session || session.role !== "ADMIN") {
    redirect("/login/admin");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <AdminDashboard />
    </main>
  );
}
