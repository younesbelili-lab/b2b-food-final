"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Dashboard = {
  totalRevenue: number;
  totalMargin: number;
  breakEvenRevenue: number;
  lowMarginPercentAlert: number;
  productMargins: Array<{
    productId: string;
    productName: string;
    marginPercent: number;
    belowThreshold: boolean;
    lossMaking: boolean;
  }>;
  ordersCount: number;
  stockAlerts: number;
  supportOpenTickets: number;
};

type StockMovement = {
  id: string;
  productId: string;
  change: number;
  reason: string;
};

type SupportTicket = {
  id: string;
  subject: string;
  status: string;
};

type Backup = {
  id: string;
  reason: string;
  bytes: number;
};

type ClientUser = {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  role: "CLIENT";
};

type ClientOrder = {
  id: string;
  createdAt: string;
  deliveryDate: string;
  deliveryAddress: string;
  status: string;
  totalTtc: number;
};

type ClientProfile = {
  client: {
    id: string;
    companyName: string;
    email: string;
    phone: string;
    address: string;
  };
  orders: ClientOrder[];
  totalAmountTtc: number;
  ordersCount: number;
};

export function AdminDashboard() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "clients">("dashboard");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClientProfile, setSelectedClientProfile] = useState<ClientProfile | null>(null);
  const [loadingClientProfile, setLoadingClientProfile] = useState(false);
  const [clientProfileError, setClientProfileError] = useState("");
  const [storageMessage, setStorageMessage] = useState("");

  const [productName, setProductName] = useState("");
  const [productOrigin, setProductOrigin] = useState("");
  const [productCategory, setProductCategory] = useState<
    "Fruits" | "Legumes" | "Viandes" | "Boissons"
  >("Fruits");
  const [productPricingUnit, setProductPricingUnit] = useState<"piece" | "kilo">("kilo");
  const [productPriceHt, setProductPriceHt] = useState("");
  const [productImage, setProductImage] = useState("");
  const [productFeedback, setProductFeedback] = useState("");

  async function checkSession() {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    const data = await response.json();
    const ok = Boolean(data.authenticated) && data.role === "ADMIN";
    setAuthenticated(ok);
    return ok;
  }

  async function loadAdminData() {
    setError("");
    const [dashboardRes, movementRes, ticketRes, backupRes, clientsRes] = await Promise.all([
      fetch("/api/admin/dashboard", { cache: "no-store" }),
      fetch("/api/admin/stock-movements", { cache: "no-store" }),
      fetch("/api/admin/support-tickets", { cache: "no-store" }),
      fetch("/api/admin/backups", { cache: "no-store" }),
      fetch("/api/admin/clients", { cache: "no-store" }),
    ]);

    if (!dashboardRes.ok || !movementRes.ok || !ticketRes.ok || !backupRes.ok || !clientsRes.ok) {
      setError("Session admin invalide. Connecte-toi a nouveau.");
      setAuthenticated(false);
      return;
    }

    const dashboardData = await dashboardRes.json();
    const movementData = await movementRes.json();
    const ticketData = await ticketRes.json();
    const backupData = await backupRes.json();
    const clientsData = await clientsRes.json();
    setDashboard(dashboardData.item);
    setMovements(movementData.items ?? []);
    setTickets(ticketData.items ?? []);
    setBackups(backupData.items ?? []);
    setClients(clientsData.items ?? []);
  }

  async function loadClientProfile(clientId: string) {
    setClientProfileError("");
    setLoadingClientProfile(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setClientProfileError(data.error ?? "Impossible de charger le profil client.");
        setSelectedClientProfile(null);
        return;
      }
      setSelectedClientProfile(data.item ?? null);
    } finally {
      setLoadingClientProfile(false);
    }
  }

  async function login() {
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "ADMIN", email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? "Echec connexion admin.");
      return;
    }
    setAuthenticated(true);
    await loadAdminData();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
    setDashboard(null);
    router.push("/login/admin");
    router.refresh();
  }

  async function createManualBackup() {
    const response = await fetch("/api/admin/backups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "manual-from-admin-ui" }),
    });
    if (!response.ok) {
      setError("Echec creation sauvegarde.");
      return;
    }
    await loadAdminData();
  }

  async function createProduct() {
    setProductFeedback("");
    const response = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: productName,
        origin: productOrigin,
        category: productCategory,
        pricingUnit: productPricingUnit,
        priceHt: Number(productPriceHt),
        image: productImage || undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setProductFeedback(data.error ?? "Erreur creation produit.");
      return;
    }
    setProductFeedback(`Produit ajoute: ${data.item.name}`);
    setProductName("");
    setProductOrigin("");
    setProductPriceHt("");
    setProductImage("");
    await loadAdminData();
  }

  useEffect(() => {
    void (async () => {
      const ok = await checkSession();
      if (ok) {
        await loadAdminData();
        try {
          const response = await fetch("/api/system/storage", { cache: "no-store" });
          const data = await response.json().catch(() => ({}));
          if (response.ok && data?.item?.message) {
            setStorageMessage(String(data.item.message));
          }
        } catch {
          // ignore diagnostics errors
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (!clients.length) {
      setSelectedClientId("");
      setSelectedClientProfile(null);
      return;
    }
    if (!selectedClientId) {
      const firstId = clients[0].id;
      setSelectedClientId(firstId);
      void loadClientProfile(firstId);
    }
  }, [clients, selectedClientId]);

  useEffect(() => {
    if (!authenticated) {
      return;
    }
    const interval = setInterval(() => {
      void loadAdminData();
      if (selectedClientId) {
        void loadClientProfile(selectedClientId);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [authenticated, selectedClientId]);

  if (!authenticated) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-10">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-3xl font-bold">Connexion administrateur</h1>
          <p className="mt-2 text-sm text-slate-600">
            Connecte-toi avec ton email et mot de passe admin.
          </p>
          <div className="mt-4 grid gap-3">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email admin"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mot de passe"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
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
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Administration</h1>
            <p className="mt-1 text-sm text-slate-600">
              Statistiques financieres, marges, stocks, support.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push("/catalogue")}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              Voir catalogue
            </button>
            <button
              type="button"
              onClick={loadAdminData}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Actualiser
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              Deconnexion
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}
        {storageMessage && <p className="mt-2 text-sm text-amber-700">{storageMessage}</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={
              activeTab === "dashboard"
                ? "rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-slate-300 px-4 py-2 text-sm"
            }
          >
            Tableau de bord
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("clients")}
            className={
              activeTab === "clients"
                ? "rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-slate-300 px-4 py-2 text-sm"
            }
          >
            Clients
          </button>
        </div>
      </section>

      {activeTab === "dashboard" && (
      <>
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold">Ajouter un produit</h2>
        <p className="mt-1 text-sm text-slate-600">
          Nom, origine, categorie et prix a la piece ou au kilo.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
            placeholder="Nom du produit"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={productOrigin}
            onChange={(event) => setProductOrigin(event.target.value)}
            placeholder="Origine (ex: Rungis)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={productCategory}
            onChange={(event) =>
              setProductCategory(event.target.value as "Fruits" | "Legumes" | "Viandes" | "Boissons")
            }
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="Fruits">Fruits</option>
            <option value="Legumes">Legumes</option>
            <option value="Viandes">Viandes</option>
            <option value="Boissons">Boissons</option>
          </select>
          <select
            value={productPricingUnit}
            onChange={(event) => setProductPricingUnit(event.target.value as "piece" | "kilo")}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="kilo">Prix au kilo</option>
            <option value="piece">Prix a la piece</option>
          </select>
          <input
            type="number"
            min={0}
            step="0.01"
            value={productPriceHt}
            onChange={(event) => setProductPriceHt(event.target.value)}
            placeholder="Prix HT"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={productImage}
            onChange={(event) => setProductImage(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Image auto selon categorie</option>
            <option value="/products/pommes-gala.svg">Visuel Fruits</option>
            <option value="/products/tomates-grappe.svg">Visuel Legumes</option>
            <option value="/products/steak-hache.svg">Visuel Viandes</option>
            <option value="/products/eau-minerale.svg">Visuel Boissons</option>
            <option value="/products/produit-generic.svg">Visuel Generique</option>
          </select>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={createProduct}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Ajouter le produit
          </button>
          {productFeedback && <p className="text-sm text-slate-700">{productFeedback}</p>}
        </div>
      </section>

      {dashboard && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Chiffre d&apos;affaires</p>
              <p className="text-2xl font-bold">{dashboard.totalRevenue.toFixed(2)} EUR</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Marge totale</p>
              <p className="text-2xl font-bold">{dashboard.totalMargin.toFixed(2)} EUR</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Seuil de rentabilite</p>
              <p className="text-2xl font-bold">{dashboard.breakEvenRevenue.toFixed(2)} EUR</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">Alertes stock</p>
              <p className="text-2xl font-bold">{dashboard.stockAlerts}</p>
            </article>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold">Controle des marges</h2>
            <div className="mt-4 space-y-2">
              {dashboard.productMargins.map((item) => (
                <article
                  key={item.productId}
                  className="flex flex-wrap items-center justify-between rounded-md border border-slate-200 p-3 text-sm"
                >
                  <span>{item.productName}</span>
                  <span>Marge: {item.marginPercent.toFixed(2)}%</span>
                  <span>
                    {item.lossMaking
                      ? "Vente a perte detectee"
                      : item.belowThreshold
                        ? "Marge faible"
                        : "OK"}
                  </span>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-bold">Mouvements de stock</h2>
              <div className="mt-3 max-h-64 space-y-2 overflow-auto text-sm">
                {movements.map((movement) => (
                  <p key={movement.id} className="rounded border border-slate-200 p-2">
                    {movement.productId} | {movement.change} | {movement.reason}
                  </p>
                ))}
                {movements.length === 0 && <p>Aucun mouvement.</p>}
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="text-xl font-bold">Tickets support</h2>
              <div className="mt-3 max-h-64 space-y-2 overflow-auto text-sm">
                {tickets.map((ticket) => (
                  <p key={ticket.id} className="rounded border border-slate-200 p-2">
                    {ticket.subject} | {ticket.status}
                  </p>
                ))}
                {tickets.length === 0 && <p>Aucun ticket.</p>}
              </div>
            </article>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">Historique sauvegardes</h2>
              <button
                type="button"
                onClick={createManualBackup}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
              >
                Creer sauvegarde
              </button>
            </div>
            <div className="space-y-2 text-sm">
              {backups.map((backup) => (
                <p key={backup.id} className="rounded border border-slate-200 p-2">
                  {backup.id} | {backup.reason} | {(backup.bytes / 1024).toFixed(2)} KB
                </p>
              ))}
              {backups.length === 0 && <p>Aucune sauvegarde pour le moment.</p>}
            </div>
          </section>
        </>
      )}
      </>
      )}

      {activeTab === "clients" && (
        <section className="grid gap-4 md:grid-cols-[320px_1fr]">
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-bold">Utilisateurs clients</h2>
            <div className="mt-3 space-y-2">
              {clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => {
                    setSelectedClientId(client.id);
                    void loadClientProfile(client.id);
                  }}
                  className={
                    selectedClientId === client.id
                      ? "w-full rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-left"
                      : "w-full rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
                  }
                >
                  <p className="font-semibold">{client.companyName}</p>
                  <p className="text-sm text-slate-600">{client.email}</p>
                </button>
              ))}
              {clients.length === 0 && <p className="text-sm text-slate-600">Aucun client inscrit.</p>}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-bold">Profil client</h2>
            {loadingClientProfile && <p className="mt-3 text-sm text-slate-600">Chargement...</p>}
            {clientProfileError && <p className="mt-3 text-sm text-rose-700">{clientProfileError}</p>}
            {!loadingClientProfile && !clientProfileError && selectedClientProfile && (
              <div className="mt-4 space-y-5">
                <div className="rounded-lg border border-slate-200 p-4 text-sm">
                  <p><span className="font-semibold">Entreprise:</span> {selectedClientProfile.client.companyName}</p>
                  <p><span className="font-semibold">Email:</span> {selectedClientProfile.client.email}</p>
                  <p><span className="font-semibold">Telephone:</span> {selectedClientProfile.client.phone || "-"}</p>
                  <p><span className="font-semibold">Adresse:</span> {selectedClientProfile.client.address || "-"}</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <article className="rounded-lg border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Total commandes</p>
                    <p className="text-2xl font-bold">{selectedClientProfile.ordersCount}</p>
                  </article>
                  <article className="rounded-lg border border-slate-200 p-4">
                    <p className="text-sm text-slate-500">Montant cumule</p>
                    <p className="text-2xl font-bold">{selectedClientProfile.totalAmountTtc.toFixed(2)} EUR</p>
                  </article>
                </div>

                <div>
                  <h3 className="text-lg font-semibold">Commandes passees</h3>
                  <div className="mt-3 space-y-2">
                    {selectedClientProfile.orders.map((order) => (
                      <div key={order.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                        <p className="font-semibold">{order.id}</p>
                        <p className="text-slate-600">
                          {order.createdAt} | {order.status}
                        </p>
                        <p className="text-slate-600">Livraison: {order.deliveryDate}</p>
                        <p className="text-slate-600">Adresse livraison: {order.deliveryAddress}</p>
                        <p className="font-semibold">{order.totalTtc.toFixed(2)} EUR TTC</p>
                      </div>
                    ))}
                    {selectedClientProfile.orders.length === 0 && (
                      <p className="text-sm text-slate-600">Aucune commande passee.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {!loadingClientProfile && !clientProfileError && !selectedClientProfile && (
              <p className="mt-3 text-sm text-slate-600">Selectionne un client pour voir son profil.</p>
            )}
          </article>
        </section>
      )}
    </div>
  );
}
