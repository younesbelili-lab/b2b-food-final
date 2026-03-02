"use client";

import { useEffect, useState } from "react";

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
};

export function SupportCenter() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");

  async function loadTickets() {
    const response = await fetch("/api/support/tickets");
    const data = await response.json();
    setTickets(data.items ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTickets();
  }, []);

  async function submitTicket() {
    setFeedback("");
    const response = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, message }),
    });
    const data = await response.json();
    if (!response.ok) {
      setFeedback(data.error ?? "Erreur support.");
      return;
    }
    setSubject("");
    setMessage("");
    setFeedback("Ticket cree.");
    await loadTickets();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="text-3xl font-bold">Support client</h1>
        <p className="mt-2 text-sm text-slate-600">
          Formulaire de contact, ticketing et historique des demandes.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold">Nouveau ticket</h2>
        <div className="mt-4 grid gap-3">
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Sujet"
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Message"
            className="min-h-28 rounded-md border border-slate-300 px-3 py-2"
          />
          <button
            type="button"
            onClick={submitTicket}
            className="w-fit rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white"
          >
            Envoyer
          </button>
          {feedback && <p className="text-sm text-slate-700">{feedback}</p>}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold">Historique des tickets</h2>
        <div className="mt-4 space-y-3">
          {tickets.map((ticket) => (
            <article key={ticket.id} className="rounded-lg border border-slate-200 p-4">
              <p className="font-semibold">{ticket.subject}</p>
              <p className="mt-1 text-sm text-slate-700">{ticket.message}</p>
              <p className="mt-2 text-xs text-slate-500">
                Statut: {ticket.status} | {new Date(ticket.createdAt).toLocaleString()}
              </p>
            </article>
          ))}
          {tickets.length === 0 && (
            <p className="text-sm text-slate-600">Aucun ticket pour le moment.</p>
          )}
        </div>
      </section>
    </div>
  );
}
