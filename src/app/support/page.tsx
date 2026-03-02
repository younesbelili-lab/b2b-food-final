import type { Metadata } from "next";
import { SupportCenter } from "@/components/support-center";

export const metadata: Metadata = {
  title: "Support | So Food Service",
  description: "Support client B2B avec tickets et suivi des demandes.",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <SupportCenter />
    </main>
  );
}
