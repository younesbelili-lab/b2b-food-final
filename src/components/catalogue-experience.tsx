"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { priceTtc, promoPriceHt } from "@/lib/pricing";

export type CatalogueProduct = {
  id: string;
  name: string;
  description: string;
  category: "Fruits" | "Legumes" | "Viandes" | "Boissons";
  subcategory?:
    | "Volailles"
    | "Viandes blanches"
    | "Viandes rouges"
    | "Eau"
    | "Jus"
    | "Soda";
  origin: string;
  pricingUnit: "piece" | "kilo";
  image: string;
  priceHt: number;
  tvaRate: number;
  isFeatured: boolean;
  isSlowMover: boolean;
  promoPercent?: number;
};

type ClientOrderLine = {
  productId: string;
  productName: string;
  quantity: number;
  lineTotalTtc: number;
};

type ClientOrder = {
  id: string;
  status: string;
  createdAt: string;
  deliveryDate: string;
  deliveryAddress?: string;
  recurrence?: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
  recurringOrderId?: string;
  totalTtc: number;
  lines: ClientOrderLine[];
  clientCompany?: string;
  clientEmail?: string;
};

type RecurringOrderHistory = {
  id: string;
  userId: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  active: boolean;
  nextRunAt: string;
  lines: Array<{ productId: string; quantity: number }>;
  clientCompany?: string;
  clientEmail?: string;
};

type AdminClient = {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  role: "CLIENT";
  deletedAt?: string;
  cancelledOrdersCount?: number;
};

type AdminClientProfile = {
  client: {
    id: string;
    companyName: string;
    email: string;
    phone: string;
    address: string;
  };
  orders: Array<{
    id: string;
    createdAt: string;
    deliveryDate: string;
    deliveryAddress: string;
    status: string;
    recurrence?: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";
    recurringOrderId?: string;
    totalTtc: number;
    lines: Array<{
      productId: string;
      productName: string;
      quantity: number;
      lineTotalTtc: number;
    }>;
  }>;
  totalAmountTtc: number;
  ordersCount: number;
};

const categories = ["Toutes", "Fruits", "Legumes", "Viandes", "Boissons"] as const;
const productCategories = ["Fruits", "Legumes", "Viandes", "Boissons"] as const;
const meatSubcategories = ["Volailles", "Viandes blanches", "Viandes rouges"] as const;
const drinkSubcategories = ["Eau", "Jus", "Soda"] as const;
const allSubcategories = [...meatSubcategories, ...drinkSubcategories] as const;

function subcategoryOptionsByCategory(category: CatalogueProduct["category"]): CatalogueProduct["subcategory"][] {
  if (category === "Viandes") {
    return [...meatSubcategories];
  }
  if (category === "Boissons") {
    return [...drinkSubcategories];
  }
  return [];
}
function categoryAccent(category: CatalogueProduct["category"]) {
  if (category === "Fruits") {
    return "from-orange-200 to-rose-200";
  }
  if (category === "Legumes") {
    return "from-emerald-200 to-lime-200";
  }
  if (category === "Viandes") {
    return "from-rose-200 to-red-300";
  }
  return "from-sky-200 to-blue-300";
}

function fallbackImageForCategory(category: CatalogueProduct["category"]) {
  if (category === "Fruits") {
    return "/products/pommes-gala.svg";
  }
  if (category === "Legumes") {
    return "/products/tomates-grappe.svg";
  }
  if (category === "Viandes") {
    return "/products/steak-hache.svg";
  }
  return "/products/eau-minerale.svg";
}

function recurrenceLabel(value?: "NONE" | "DAILY" | "WEEKLY" | "MONTHLY") {
  if (!value || value === "NONE") {
    return "Sans recurrence";
  }
  if (value === "DAILY") {
    return "Quotidienne";
  }
  if (value === "WEEKLY") {
    return "Hebdomadaire";
  }
  return "Mensuelle";
}

function normalizeProduct(input: Partial<CatalogueProduct>): CatalogueProduct | null {
  if (!input.id || !input.name) {
    return null;
  }
  const category: CatalogueProduct["category"] =
    input.category === "Fruits" || input.category === "Legumes" || input.category === "Viandes" || input.category === "Boissons"
      ? input.category
      : "Fruits";
  const subcategoryCandidates = subcategoryOptionsByCategory(category);
  const subcategory =
    typeof input.subcategory === "string" && subcategoryCandidates.includes(input.subcategory as CatalogueProduct["subcategory"])
      ? (input.subcategory as CatalogueProduct["subcategory"])
      : undefined;
  return {
    id: String(input.id),
    name: String(input.name),
    description: String(input.description ?? ""),
    category,
    subcategory,
    origin: String(input.origin ?? "Origine non precisee"),
    pricingUnit: input.pricingUnit === "piece" ? "piece" : "kilo",
    image: typeof input.image === "string" && input.image.trim() ? input.image : fallbackImageForCategory(category),
    priceHt: Number(input.priceHt ?? 0),
    tvaRate: Number(input.tvaRate ?? 5.5),
    isFeatured: Boolean(input.isFeatured),
    isSlowMover: Boolean(input.isSlowMover),
    promoPercent: typeof input.promoPercent === "number" ? input.promoPercent : undefined,
  };
}

export function CatalogueExperience({ products }: { products: CatalogueProduct[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [productsState, setProductsState] = useState<CatalogueProduct[]>(
    products.map((item) => normalizeProduct(item)).filter((item): item is CatalogueProduct => item !== null),
  );
  const [activeTab, setActiveTab] = useState<"catalogue" | "history" | "admin-add" | "clients">("catalogue");
  const [category, setCategory] = useState<(typeof categories)[number]>("Toutes");
  const [onlyPromo, setOnlyPromo] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState<
    NonNullable<CatalogueProduct["subcategory"]> | "Toutes"
  >("Toutes");
  const [productSearch, setProductSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [ordersState, setOrdersState] = useState<ClientOrder[]>([]);
  const [recurringOrdersState, setRecurringOrdersState] = useState<RecurringOrderHistory[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [sessionRole, setSessionRole] = useState<"ADMIN" | "CLIENT" | "">("");
  const [productName, setProductName] = useState("");
  const [productOrigin, setProductOrigin] = useState("");
  const [productCategory, setProductCategory] = useState<(typeof productCategories)[number]>("Fruits");
  const [productSubcategory, setProductSubcategory] = useState<CatalogueProduct["subcategory"] | "">("");
  const [productPricingUnit, setProductPricingUnit] = useState<"piece" | "kilo">("kilo");
  const [productPriceHt, setProductPriceHt] = useState("");
  const [existingProductSearch, setExistingProductSearch] = useState("");
  const [existingProductCategory, setExistingProductCategory] = useState<(typeof categories)[number]>("Toutes");
  const [productFeedback, setProductFeedback] = useState("");
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  const [adminActionFeedback, setAdminActionFeedback] = useState("");
  const [processingProductId, setProcessingProductId] = useState<string | null>(null);
  const [adminClients, setAdminClients] = useState<AdminClient[]>([]);
  const [deletedAdminClients, setDeletedAdminClients] = useState<AdminClient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClientProfile, setSelectedClientProfile] = useState<AdminClientProfile | null>(null);
  const [loadingClientProfile, setLoadingClientProfile] = useState(false);
  const [clientProfileError, setClientProfileError] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [offerTab, setOfferTab] = useState<"add" | "existing">("add");
  const [orderClientSearch, setOrderClientSearch] = useState("");
  const [clientsTab, setClientsTab] = useState<"active" | "deleted">("active");
  const [processingClientId, setProcessingClientId] = useState<string | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editDeliveryDate, setEditDeliveryDate] = useState("");
  const [editDeliveryAddress, setEditDeliveryAddress] = useState("");
  const [editLines, setEditLines] = useState<Array<{ productId: string; quantity: number }>>([]);
  const [isApplyingCatalogueEdit, setIsApplyingCatalogueEdit] = useState(false);
  const editOrderIdFromQuery = searchParams.get("editOrder");

  async function reloadProducts() {
    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      setProductsState(
        items
          .map((item: Partial<CatalogueProduct>) => normalizeProduct(item))
          .filter((item: CatalogueProduct | null): item is CatalogueProduct => item !== null),
      );
    } catch {
      // keep current list if reload fails
    }
  }

  async function reloadOrders() {
    setHistoryError("");
    setIsLoadingOrders(true);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setHistoryError(data.error ?? "Impossible de charger l'historique des commandes.");
        return;
      }
      setOrdersState(Array.isArray(data?.items) ? data.items : []);
      setRecurringOrdersState(Array.isArray(data?.recurringItems) ? data.recurringItems : []);
    } catch {
      setHistoryError("Impossible de charger l'historique des commandes.");
    } finally {
      setIsLoadingOrders(false);
    }
  }

  async function reloadAdminClients() {
    try {
      const response = await fetch("/api/admin/clients", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return;
      }
      const list: AdminClient[] = Array.isArray(data?.items) ? data.items : [];
      const deletedList: AdminClient[] = Array.isArray(data?.deletedItems) ? data.deletedItems : [];
      setAdminClients(list);
      setDeletedAdminClients(deletedList);
      if (!selectedClientId && list.length > 0) {
        const firstId = list[0].id;
        setSelectedClientId(firstId);
        await loadAdminClientProfile(firstId);
      } else if (selectedClientId && !list.some((item) => item.id === selectedClientId)) {
        setSelectedClientId("");
        setSelectedClientProfile(null);
      }
    } catch {
      // ignore
    }
  }

  async function loadAdminClientProfile(clientId: string) {
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

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!response.ok) {
          setSessionRole("");
          router.replace("/login/client");
          return;
        }
        const data = await response.json();
        if (!data?.authenticated) {
          setSessionRole("");
          router.replace("/login/client");
          return;
        }
        const role = data?.role === "ADMIN" ? "ADMIN" : "CLIENT";
        setSessionRole(role);
        setActiveTab(role === "ADMIN" ? "admin-add" : "catalogue");
      } catch {
        setSessionRole("");
        router.replace("/login/client");
        return;
      }
      await reloadProducts();
      await reloadOrders();
      await reloadAdminClients();
    })();
  }, [router]);

  useEffect(() => {
    if (!sessionRole || !editOrderIdFromQuery) {
      return;
    }
    void (async () => {
      try {
        const response = await fetch(`/api/orders/${editOrderIdFromQuery}`, {
          cache: "no-store",
          credentials: "include",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.item) {
          setHistoryError(data.error ?? "Commande introuvable pour edition.");
          return;
        }
        const order = data.item as ClientOrder;
        const nextQuantities: Record<string, number> = {};
        for (const line of order.lines) {
          nextQuantities[line.productId] = line.quantity;
        }
        setQuantities(nextQuantities);
        setActiveTab("catalogue");
      } catch {
        setHistoryError("Impossible de charger la commande a modifier.");
      }
    })();
  }, [sessionRole, editOrderIdFromQuery]);

  useEffect(() => {
    if (!sessionRole) {
      return;
    }
    function onVisible() {
      if (document.visibilityState !== "visible") {
        return;
      }
      void reloadProducts();
      void reloadOrders();
      if (sessionRole === "ADMIN") {
        void reloadAdminClients();
        if (selectedClientId) {
          void loadAdminClientProfile(selectedClientId);
        }
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [sessionRole, selectedClientId]);

  const productSubcategoryOptions = useMemo(
    () => subcategoryOptionsByCategory(productCategory),
    [productCategory],
  );

  useEffect(() => {
    if (!productSubcategory) {
      return;
    }
    if (!productSubcategoryOptions.includes(productSubcategory as CatalogueProduct["subcategory"])) {
      setProductSubcategory("");
    }
  }, [productSubcategory, productSubcategoryOptions]);

  const filteredProducts = useMemo(() => {
    return productsState.filter((product) => {
      if (category !== "Toutes" && product.category !== category) {
        return false;
      }
      if (selectedSubcategory !== "Toutes" && product.subcategory !== selectedSubcategory) {
        return false;
      }
      if (onlyPromo && !product.promoPercent) {
        return false;
      }
      const search = productSearch.trim().toLowerCase();
      if (search) {
        const haystack = `${product.name} ${product.description} ${product.origin} ${product.category} ${product.subcategory ?? ""}`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [productsState, category, selectedSubcategory, onlyPromo, productSearch]);

  const visibleSubcategories = useMemo<NonNullable<CatalogueProduct["subcategory"]>[]>(() => {
    if (category === "Viandes") {
      return [...meatSubcategories];
    }
    if (category === "Boissons") {
      return [...drinkSubcategories];
    }
    return [];
  }, [category]);

  useEffect(() => {
    if (visibleSubcategories.length === 0) {
      if (selectedSubcategory !== "Toutes") {
        setSelectedSubcategory("Toutes");
      }
      return;
    }
    if (
      selectedSubcategory !== "Toutes" &&
      !visibleSubcategories.includes(selectedSubcategory)
    ) {
      setSelectedSubcategory("Toutes");
    }
  }, [visibleSubcategories, selectedSubcategory]);

  const filteredAdminClients = useMemo(() => {
    const search = clientSearch.trim().toLowerCase();
    if (!search) {
      return adminClients;
    }
    return adminClients.filter((client) => {
      const haystack = `${client.companyName} ${client.email} ${client.phone} ${client.address}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [adminClients, clientSearch]);

  const filteredDeletedAdminClients = useMemo(() => {
    const search = clientSearch.trim().toLowerCase();
    if (!search) {
      return deletedAdminClients;
    }
    return deletedAdminClients.filter((client) => {
      const haystack = `${client.companyName} ${client.email} ${client.phone} ${client.address}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [deletedAdminClients, clientSearch]);

  const filteredExistingProducts = useMemo(() => {
    const search = existingProductSearch.trim().toLowerCase();
    return productsState.filter((product) => {
      if (existingProductCategory !== "Toutes" && product.category !== existingProductCategory) {
        return false;
      }
      if (!search) {
        return true;
      }
      const haystack = `${product.name} ${product.origin} ${product.category} ${product.subcategory ?? ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [productsState, existingProductSearch, existingProductCategory]);

  const filteredOrders = useMemo(() => {
    const search = orderClientSearch.trim().toLowerCase();
    const source =
      sessionRole === "ADMIN"
        ? [...ordersState].sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime())
        : [...ordersState];

    if (sessionRole !== "ADMIN" || !search) {
      return source;
    }

    return source.filter((order) => {
      const haystack = `${order.clientCompany ?? ""} ${order.clientEmail ?? ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [ordersState, orderClientSearch, sessionRole]);

  const selectedTvaRate = productCategory === "Boissons" ? 20 : 5.5;
  const productPriceTtcEstimate = useMemo(() => {
    const ht = Number(productPriceHt);
    if (Number.isNaN(ht) || ht <= 0) {
      return 0;
    }
    return ht * (1 + selectedTvaRate / 100);
  }, [productPriceHt, selectedTvaRate]);

  const selectedLines = useMemo(() => {
    return Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
  }, [quantities]);

  const selectedTotal = useMemo(() => {
    const productById = new Map(productsState.map((product) => [product.id, product]));
    return selectedLines.reduce((sum, line) => {
      const product = productById.get(line.productId);
      if (!product) {
        return sum;
      }
      const unitHt = promoPriceHt(product.priceHt, product.promoPercent);
      const unitTtc = priceTtc(unitHt, product.tvaRate);
      return sum + unitTtc * line.quantity;
    }, 0);
  }, [productsState, selectedLines]);

  const selectedDetailed = useMemo(() => {
    const productById = new Map(productsState.map((product) => [product.id, product]));
    return selectedLines
      .map((line) => {
        const product = productById.get(line.productId);
        if (!product) {
          return null;
        }
        const unitHt = promoPriceHt(product.priceHt, product.promoPercent);
        const unitTtc = priceTtc(unitHt, product.tvaRate);
        return {
          productId: line.productId,
          name: product.name,
          quantity: line.quantity,
          unitTtc,
          lineTotalTtc: unitTtc * line.quantity,
        };
      })
      .filter(
        (
          item,
        ): item is {
          productId: string;
          name: string;
          quantity: number;
          unitTtc: number;
          lineTotalTtc: number;
        } => item !== null,
      );
  }, [productsState, selectedLines]);

  function updateQuantity(productId: string, value: number) {
    setQuantities((prev) => ({
      ...prev,
      [productId]: Number.isNaN(value) ? 0 : Math.max(0, Math.floor(value)),
    }));
  }

  function goToCheckout() {
    if (!selectedLines.length) {
      return;
    }
    const cartParam = selectedLines
      .map((line) => `${line.productId}:${line.quantity}`)
      .join(",");
    router.push(`/commander?cart=${encodeURIComponent(cartParam)}`);
  }

  async function createProduct() {
    setProductFeedback("");
    setAdminActionFeedback("");
    const parsedPrice = Number(productPriceHt);
    if (!productName.trim()) {
      setProductFeedback("Le nom du produit est obligatoire.");
      return;
    }
    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      setProductFeedback("Le prix doit etre superieur a 0.");
      return;
    }

    setIsSubmittingProduct(true);
    try {
      const sessionResponse = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "include",
      });
      const sessionData = await sessionResponse.json().catch(() => ({}));
      if (!sessionResponse.ok || sessionData?.role !== "ADMIN") {
        setProductFeedback("Session admin invalide. Connecte-toi en tant qu'admin.");
        return;
      }

      const response = await fetch("/api/admin/products", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: productName.trim(),
          origin: productOrigin.trim() || "Origine non precisee",
          category: productCategory,
          subcategory: productSubcategory || undefined,
          pricingUnit: productPricingUnit,
          priceHt: parsedPrice,
          tvaRate: selectedTvaRate,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 403) {
          setProductFeedback("Acces admin refuse. Reconnecte-toi en admin.");
          return;
        }
        setProductFeedback(data.error ?? "Erreur lors de l'ajout du produit.");
        return;
      }
      if (data?.item) {
        setProductsState((prev) => [data.item as CatalogueProduct, ...prev]);
      }

      setProductFeedback(`Produit ajoute: ${data.item?.name ?? productName.trim()}`);
      setProductName("");
      setProductOrigin("");
      setProductPriceHt("");
      setProductSubcategory("");
      setCategory("Toutes");
      setOnlyPromo(false);
      setActiveTab("catalogue");
      await reloadProducts();
    } finally {
      setIsSubmittingProduct(false);
    }
  }

  async function updateProduct(
    productId: string,
    payload: {
      name: string;
      origin: string;
      category: CatalogueProduct["category"];
      subcategory?: CatalogueProduct["subcategory"];
      pricingUnit: CatalogueProduct["pricingUnit"];
      priceHt: number;
      image: string;
    },
  ) {
    setAdminActionFeedback("");
    setProcessingProductId(productId);
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 403) {
          setAdminActionFeedback("Acces admin refuse. Reconnecte-toi en admin.");
          return;
        }
        setAdminActionFeedback(data.error ?? "Erreur modification produit.");
        return;
      }
      if (data?.item) {
        setProductsState((prev) =>
          prev.map((product) => (product.id === productId ? (data.item as CatalogueProduct) : product)),
        );
      }
      setAdminActionFeedback(`Produit modifie: ${data.item?.name ?? payload.name}`);
      await reloadProducts();
    } finally {
      setProcessingProductId(null);
    }
  }

  async function deleteProduct(productId: string, productName: string) {
    setAdminActionFeedback("");
    setProcessingProductId(productId);
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 403) {
          setAdminActionFeedback("Acces admin refuse. Reconnecte-toi en admin.");
          return;
        }
        setAdminActionFeedback(data.error ?? "Erreur suppression produit.");
        return;
      }
      setProductsState((prev) => prev.filter((product) => product.id !== productId));
      setAdminActionFeedback(`Produit supprime: ${data.item?.name ?? productName}`);
      await reloadProducts();
    } finally {
      setProcessingProductId(null);
    }
  }

  async function deleteClient(clientId: string) {
    setClientProfileError("");
    setProcessingClientId(clientId);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setClientProfileError(data.error ?? "Erreur suppression client.");
        return;
      }
      if (selectedClientId === clientId) {
        setSelectedClientId("");
        setSelectedClientProfile(null);
      }
      await reloadAdminClients();
      await reloadOrders();
    } finally {
      setProcessingClientId(null);
    }
  }

  async function restoreClient(clientId: string) {
    setClientProfileError("");
    setProcessingClientId(clientId);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setClientProfileError(data.error ?? "Erreur restauration client.");
        return;
      }
      await reloadAdminClients();
      await reloadOrders();
      setClientsTab("active");
    } finally {
      setProcessingClientId(null);
    }
  }

  function startOrderEdit(order: ClientOrder) {
    setEditingOrderId(order.id);
    setEditDeliveryDate(order.deliveryDate);
    setEditDeliveryAddress(order.deliveryAddress ?? "");
    setEditLines(order.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })));
  }

  function updateEditLineQuantity(productId: string, quantity: number) {
    setEditLines((prev) =>
      prev.map((line) =>
        line.productId === productId
          ? { ...line, quantity: Math.max(1, Math.floor(Number.isNaN(quantity) ? 1 : quantity)) }
          : line,
      ),
    );
  }

  function removeEditLine(productId: string) {
    setEditLines((prev) => prev.filter((line) => line.productId !== productId));
  }

  async function saveOrderEdit(orderId: string) {
    setHistoryError("");
    setProcessingOrderId(orderId);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateOrder",
          deliveryDate: editDeliveryDate,
          deliveryAddress: editDeliveryAddress,
          lines: editLines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setHistoryError(data.error ?? "Erreur modification commande.");
        return;
      }
      setEditingOrderId(null);
      setEditLines([]);
      await reloadOrders();
    } finally {
      setProcessingOrderId(null);
    }
  }

  async function cancelOrder(orderId: string) {
    setHistoryError("");
    setProcessingOrderId(orderId);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setHistoryError(data.error ?? "Erreur annulation commande.");
        return;
      }
      if (editingOrderId === orderId) {
        setEditingOrderId(null);
        setEditLines([]);
      }
      await reloadOrders();
      if (sessionRole === "ADMIN") {
        await reloadAdminClients();
      }
    } finally {
      setProcessingOrderId(null);
    }
  }

  async function applyCatalogueSelectionToOrder() {
    if (!editOrderIdFromQuery) {
      return;
    }
    if (!selectedLines.length) {
      setHistoryError("Selectionne au moins un article pour cette commande.");
      return;
    }
    setIsApplyingCatalogueEdit(true);
    setHistoryError("");
    try {
      const response = await fetch(`/api/orders/${editOrderIdFromQuery}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateOrder",
          lines: selectedLines.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setHistoryError(data.error ?? "Erreur de mise a jour de la commande.");
        return;
      }
      await reloadOrders();
      router.replace("/catalogue");
      setActiveTab("history");
    } finally {
      setIsApplyingCatalogueEdit(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {sessionRole === "ADMIN" && (
            <button
              type="button"
              onClick={() => setActiveTab("admin-add")}
              className={
                activeTab === "admin-add"
                  ? "rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              }
            >
              Gestion de l'offre
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("catalogue")}
            className={
              activeTab === "catalogue"
                ? "rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            }
          >
            {sessionRole === "ADMIN" ? "Vue cote client" : "Catalogue"}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("history");
              void reloadOrders();
            }}
            className={
              activeTab === "history"
                ? "rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            }
          >
            {sessionRole === "ADMIN" ? "Commandes a preparer" : "Commandes passees"}
          </button>
          {sessionRole === "ADMIN" && (
            <button
              type="button"
              onClick={() => {
                setActiveTab("clients");
                void reloadAdminClients();
              }}
              className={
                activeTab === "clients"
                  ? "rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              }
            >
              Clients
            </button>
          )}
        </div>
      </section>

      {sessionRole === "ADMIN" && activeTab === "admin-add" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">Gestion de l'offre</h2>
          <p className="mt-1 text-sm text-slate-600">
            Gere l'ajout, la modification et la suppression des produits.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOfferTab("add")}
              className={
                offerTab === "add"
                  ? "rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              }
            >
              Ajouter un produit
            </button>
            <button
              type="button"
              onClick={() => setOfferTab("existing")}
              className={
                offerTab === "existing"
                  ? "rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              }
            >
              Produits existants
            </button>
          </div>

          {offerTab === "add" && (
            <>
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
              placeholder="Provenance (optionnel)"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={productCategory}
              onChange={(event) =>
                setProductCategory(event.target.value as (typeof productCategories)[number])
              }
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {productCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {productSubcategoryOptions.length > 0 && (
              <select
                value={productSubcategory}
                onChange={(event) => setProductSubcategory(event.target.value as CatalogueProduct["subcategory"] | "")}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Sous-categorie</option>
                {productSubcategoryOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            )}
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
          <input
            type="text"
            readOnly
            value={productPriceTtcEstimate > 0 ? `${productPriceTtcEstimate.toFixed(2)} EUR TTC` : ""}
            placeholder="Prix TTC (calcule automatiquement)"
            className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
          />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={createProduct}
              disabled={isSubmittingProduct}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
            >
              {isSubmittingProduct ? "Ajout..." : "Ajouter le produit"}
            </button>
            {productFeedback && <p className="text-sm text-slate-700">{productFeedback}</p>}
          </div>
            </>
          )}

          {offerTab === "existing" && (
            <div className="mt-6 border-t border-slate-200 pt-4">
            <h3 className="text-lg font-semibold">Produits existants (modifier / supprimer)</h3>
            <p className="mt-1 text-sm text-slate-600">
              Les changements sont enregistres definitivement.
            </p>
            <input
              type="search"
              value={existingProductSearch}
              onChange={(event) => setExistingProductSearch(event.target.value)}
              placeholder="Rechercher dans les produits existants..."
              className="mt-3 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={existingProductCategory}
              onChange={(event) => setExistingProductCategory(event.target.value as (typeof categories)[number])}
              className="mt-3 w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <div className="mt-3 space-y-3">
              {filteredExistingProducts.map((product) => {
                return (
                  <form
                    key={product.id}
                    className="rounded-lg border border-slate-200 p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      void updateProduct(product.id, {
                        name: String(formData.get("name") ?? ""),
                        origin: String(formData.get("origin") ?? ""),
                        category: String(formData.get("category") ?? "Fruits") as CatalogueProduct["category"],
                        subcategory:
                          (String(formData.get("subcategory") ?? "") as CatalogueProduct["subcategory"]) || undefined,
                        pricingUnit: String(formData.get("pricingUnit") ?? "kilo") as CatalogueProduct["pricingUnit"],
                        priceHt: Number(formData.get("priceHt") ?? 0),
                        image: product.image,
                      });
                    }}
                  >
                    <div className="grid gap-2 md:grid-cols-3">
                      <input
                        name="name"
                        defaultValue={product.name}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                      <input
                        name="origin"
                        defaultValue={product.origin}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                      <input
                        name="priceHt"
                        type="number"
                        min={0}
                        step="0.01"
                        defaultValue={product.priceHt}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                      <select
                        name="category"
                        defaultValue={product.category}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      >
                        {productCategories.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <select
                        name="subcategory"
                        defaultValue={product.subcategory ?? ""}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Sous-categorie</option>
                        {allSubcategories.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <select
                        name="pricingUnit"
                        defaultValue={product.pricingUnit}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="kilo">Prix au kilo</option>
                        <option value="piece">Prix a la piece</option>
                      </select>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={processingProductId === product.id}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
                      >
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        disabled={processingProductId === product.id}
                        onClick={() => void deleteProduct(product.id, product.name)}
                        className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 disabled:text-slate-400"
                      >
                        Supprimer
                      </button>
                    </div>
                  </form>
                );
              })}
            </div>
            {adminActionFeedback && <p className="mt-3 text-sm text-slate-700">{adminActionFeedback}</p>}
          </div>
          )}
        </section>
      )}

      {sessionRole === "ADMIN" && activeTab === "clients" && (
        <section className="grid gap-4 md:grid-cols-[320px_1fr]">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Utilisateurs clients</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setClientsTab("active")}
                className={
                  clientsTab === "active"
                    ? "rounded-full bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                }
              >
                Utilisateurs clients
              </button>
              <button
                type="button"
                onClick={() => setClientsTab("deleted")}
                className={
                  clientsTab === "deleted"
                    ? "rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                }
              >
                Utilisateurs supprimes
              </button>
            </div>
            <input
              type="search"
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
              placeholder="Rechercher un client..."
              className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="mt-3 space-y-2">
              {clientsTab === "active" &&
                filteredAdminClients.map((client) => (
                  <div
                    key={client.id}
                    className={
                      selectedClientId === client.id
                        ? "rounded-lg border border-indigo-300 bg-indigo-50 p-3"
                        : "rounded-lg border border-slate-200 p-3"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClientId(client.id);
                        void loadAdminClientProfile(client.id);
                      }}
                      className="w-full text-left"
                    >
                      <p className="font-semibold">{client.companyName}</p>
                      <p className="text-sm text-slate-600">{client.email}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteClient(client.id)}
                      disabled={processingClientId === client.id}
                      className="mt-2 rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:text-slate-400"
                    >
                      {processingClientId === client.id ? "Suppression..." : "Supprimer"}
                    </button>
                  </div>
                ))}
              {clientsTab === "deleted" &&
                filteredDeletedAdminClients.map((client) => (
                  <div key={client.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
                    <p className="font-semibold">{client.companyName}</p>
                    <p className="text-sm text-slate-600">{client.email}</p>
                    <p className="text-xs text-slate-500">
                      Supprime le: {client.deletedAt ? new Date(client.deletedAt).toLocaleString("fr-FR") : "-"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Commandes annulees: {client.cancelledOrdersCount ?? 0}
                    </p>
                    <button
                      type="button"
                      onClick={() => void restoreClient(client.id)}
                      disabled={processingClientId === client.id}
                      className="mt-2 rounded-md border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:text-slate-400"
                    >
                      {processingClientId === client.id ? "Restauration..." : "Desupprimer"}
                    </button>
                  </div>
                ))}
              {clientsTab === "active" && filteredAdminClients.length === 0 && (
                <p className="text-sm text-slate-600">Aucun client actif.</p>
              )}
              {clientsTab === "deleted" && filteredDeletedAdminClients.length === 0 && (
                <p className="text-sm text-slate-600">Aucun utilisateur supprime.</p>
              )}
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">Profil client</h2>
            {clientsTab === "deleted" && (
              <p className="mt-3 text-sm text-slate-600">
                Selectionne l&apos;onglet utilisateurs clients pour afficher un profil detaille.
              </p>
            )}
            {clientsTab === "active" && (
              <>
            {loadingClientProfile && <p className="mt-3 text-sm text-slate-600">Chargement...</p>}
            {clientProfileError && <p className="mt-3 text-sm text-rose-700">{clientProfileError}</p>}
            {!loadingClientProfile && !clientProfileError && selectedClientProfile && (
              <div className="mt-3 space-y-4">
                <div className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p><span className="font-semibold">Entreprise:</span> {selectedClientProfile.client.companyName}</p>
                  <p><span className="font-semibold">Email:</span> {selectedClientProfile.client.email}</p>
                  <p><span className="font-semibold">Telephone:</span> {selectedClientProfile.client.phone}</p>
                  <p><span className="font-semibold">Adresse:</span> {selectedClientProfile.client.address}</p>
                </div>
                <p className="text-sm font-semibold">
                  Total commandes: {selectedClientProfile.ordersCount} | Montant cumule: {selectedClientProfile.totalAmountTtc.toFixed(2)} EUR
                </p>
                <div>
                  <h3 className="text-lg font-semibold">Detail des commandes</h3>
                  <div className="mt-3 space-y-3">
                    {selectedClientProfile.orders.map((order) => (
                      <article key={order.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">Commande {order.id}</p>
                          <p className="font-semibold">{order.totalTtc.toFixed(2)} EUR TTC</p>
                        </div>
                        <p className="text-slate-600">
                          {order.createdAt} | {order.status}
                        </p>
                        <p className="text-slate-600">
                          Livraison: {order.deliveryDate} | Adresse: {order.deliveryAddress}
                        </p>
                        <p className="text-slate-600">
                          Recurrence: {recurrenceLabel(order.recurrence)}
                        </p>
                        <div className="mt-2 overflow-hidden rounded-md border border-slate-200">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-100 text-slate-600">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold">Article</th>
                                <th className="px-3 py-2 text-right font-semibold">Quantite</th>
                                <th className="px-3 py-2 text-right font-semibold">Montant</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.lines.map((line) => (
                                <tr key={`${order.id}-${line.productId}`} className="border-t border-slate-200">
                                  <td className="px-3 py-2">{line.productName}</td>
                                  <td className="px-3 py-2 text-right">{line.quantity}</td>
                                  <td className="px-3 py-2 text-right">{line.lineTotalTtc.toFixed(2)} EUR</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </article>
                    ))}
                    {selectedClientProfile.orders.length === 0 && (
                      <p className="text-sm text-slate-600">Aucune commande pour ce client.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
              </>
            )}
          </article>
        </section>
      )}

      {activeTab === "catalogue" && (
        <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="Rechercher un produit..."
            className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="text-sm font-semibold text-slate-700">Categorie</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={
                  category === item
                    ? "rounded-full bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white"
                    : "rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                }
              >
                {item}
              </button>
            ))}
          </div>
          {visibleSubcategories.length > 0 && (
            <>
              <p className="text-sm font-semibold text-slate-700">Sous-categorie</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSubcategory("Toutes")}
                  className={
                    selectedSubcategory === "Toutes"
                      ? "rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
                      : "rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                  }
                >
                  Toutes
                </button>
                {visibleSubcategories.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setSelectedSubcategory(item)}
                    className={
                      selectedSubcategory === item
                        ? "rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
                        : "rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </>
          )}
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={onlyPromo}
              onChange={(event) => setOnlyPromo(event.target.checked)}
            />
            Promotions uniquement
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-700">
            {selectedLines.length} article(s) selectionne(s) | Total estime:{" "}
            <span className="font-semibold">{selectedTotal.toFixed(2)} EUR TTC</span>
          </p>
          {editOrderIdFromQuery ? (
            <button
              type="button"
              onClick={() => void applyCatalogueSelectionToOrder()}
              disabled={!selectedLines.length || isApplyingCatalogueEdit}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
            >
              {isApplyingCatalogueEdit ? "Application..." : "Appliquer a la commande"}
            </button>
          ) : (
            <button
              type="button"
              onClick={goToCheckout}
              disabled={!selectedLines.length}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-400"
            >
              Passer la commande
            </button>
          )}
        </div>
        {editOrderIdFromQuery && (
          <p className="mt-2 text-xs text-slate-600">
            Mode edition commande {editOrderIdFromQuery}: ajuste le panier puis clique sur "Appliquer a la commande".
          </p>
        )}
        <div className="mt-3 border-t border-slate-200 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Panier</p>
          {selectedDetailed.length > 0 ? (
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Article</th>
                    <th className="px-3 py-2 text-right font-semibold">Quantite</th>
                    <th className="px-3 py-2 text-right font-semibold">Prix TTC</th>
                    <th className="px-3 py-2 text-right font-semibold">Sous-total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDetailed.map((item) => (
                    <tr key={item.productId} className="border-t border-slate-200">
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">{item.unitTtc.toFixed(2)} EUR</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {item.lineTotalTtc.toFixed(2)} EUR
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className="font-semibold">Total panier: {selectedTotal.toFixed(2)} EUR TTC</span>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              Aucun article selectionne pour le moment.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredProducts.map((product) => {
          const currentPriceHt = promoPriceHt(product.priceHt, product.promoPercent);
          const currentPriceTtc = priceTtc(currentPriceHt, product.tvaRate);
          const oldPriceTtc = priceTtc(product.priceHt, product.tvaRate);

          return (
            <article key={product.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className={`h-44 w-full bg-gradient-to-br ${categoryAccent(product.category)}`}>
                <Image
                  src={product.image || fallbackImageForCategory(product.category)}
                  alt={product.name}
                  width={1200}
                  height={800}
                  unoptimized
                  className="h-44 w-full object-contain p-2"
                />
              </div>
              <div className="p-5">
                <p className="text-xs uppercase tracking-wide text-slate-500">{product.category}</p>
                {product.subcategory && (
                  <p className="mt-1 text-xs font-semibold text-slate-600">{product.subcategory}</p>
                )}
                {!product.subcategory && (product.category === "Viandes" || product.category === "Boissons") && (
                  <p className="mt-1 text-xs font-semibold text-slate-400">Sous-categorie a definir</p>
                )}
                <h2 className="mt-1 text-xl font-semibold">{product.name}</h2>
                <p className="mt-2 text-sm text-slate-600">{product.description}</p>
                <p className="mt-1 text-sm text-slate-500">Origine: {product.origin}</p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {product.isFeatured && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700">
                      Produit phare
                    </span>
                  )}
                  {product.promoPercent && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-700">
                      Promo -{product.promoPercent}%
                    </span>
                  )}
                </div>

                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p>
                    Prix TTC: {currentPriceTtc.toFixed(2)} EUR /{" "}
                    {product.pricingUnit === "piece" ? "piece" : "kilo"}
                  </p>
                  {product.promoPercent && (
                    <p className="text-xs text-slate-500 line-through">
                      Ancien prix TTC: {oldPriceTtc.toFixed(2)} EUR
                    </p>
                  )}
                </div>

                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Quantite
                  <input
                    type="number"
                    min={0}
                    value={quantities[product.id] ?? 0}
                    onChange={(event) => updateQuantity(product.id, Number(event.target.value))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>
            </article>
          );
        })}
      </section>
        </>
      )}

      {activeTab === "history" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold">
            {sessionRole === "ADMIN" ? "Commandes a preparer" : "Commandes passees"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Detail des commandes avec contenu et montant total.
          </p>
          {sessionRole === "ADMIN" && (
            <input
              type="search"
              value={orderClientSearch}
              onChange={(event) => setOrderClientSearch(event.target.value)}
              placeholder="Rechercher un client (entreprise ou email)..."
              className="mt-3 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          )}
          {isLoadingOrders && <p className="mt-3 text-sm text-slate-600">Chargement...</p>}
          {historyError && <p className="mt-3 text-sm text-rose-700">{historyError}</p>}
          {!isLoadingOrders && !historyError && (
            <div className="mt-4 space-y-3">
              {filteredOrders.map((order) => (
                <article key={order.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">Commande {order.id}</p>
                    <p className="text-sm font-semibold">{order.totalTtc.toFixed(2)} EUR TTC</p>
                  </div>
                  {sessionRole === "ADMIN" && (
                    <p className="mt-1 text-sm text-slate-600">
                      Client: {order.clientCompany ?? "Client inconnu"}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-slate-600">
                    Statut: {order.status} | Livraison: {order.deliveryDate}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Recurrence: {recurrenceLabel(order.recurrence)}
                  </p>
                  {order.deliveryAddress && (
                    <p className="mt-1 text-sm text-slate-600">
                      Adresse: {order.deliveryAddress}
                    </p>
                  )}
                  <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Article</th>
                          <th className="px-3 py-2 text-right font-semibold">Quantite</th>
                          <th className="px-3 py-2 text-right font-semibold">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.lines.map((line) => (
                          <tr key={`${order.id}-${line.productId}`} className="border-t border-slate-200">
                            <td className="px-3 py-2">{line.productName}</td>
                            <td className="px-3 py-2 text-right">{line.quantity}</td>
                            <td className="px-3 py-2 text-right">{line.lineTotalTtc.toFixed(2)} EUR</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startOrderEdit(order)}
                      disabled={processingOrderId === order.id || order.status === "ANNULEE"}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:text-slate-400"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => void cancelOrder(order.id)}
                      disabled={processingOrderId === order.id || order.status === "ANNULEE"}
                      className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:text-slate-400"
                    >
                      {processingOrderId === order.id ? "Traitement..." : "Supprimer / Annuler"}
                    </button>
                  </div>
                  {editingOrderId === order.id && (
                    <div className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                      <label className="font-medium text-slate-700">
                        Nouvelle date de livraison
                        <input
                          type="date"
                          value={editDeliveryDate}
                          onChange={(event) => setEditDeliveryDate(event.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                        />
                      </label>
                      <label className="font-medium text-slate-700">
                        Nouvelle adresse de livraison
                        <textarea
                          rows={2}
                          value={editDeliveryAddress}
                          onChange={(event) => setEditDeliveryAddress(event.target.value)}
                          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                        />
                      </label>
                      <div className="rounded-md border border-slate-200 bg-white p-3">
                        <p className="font-medium text-slate-700">Contenu de la commande</p>
                        <div className="mt-2 space-y-2">
                          {editLines.map((line) => {
                            const product = productsState.find((item) => item.id === line.productId);
                            return (
                              <div key={line.productId} className="grid grid-cols-[1fr_110px_auto] gap-2">
                                <div className="rounded-md border border-slate-200 px-3 py-2 text-xs">
                                  {product?.name ?? line.productId}
                                </div>
                                <input
                                  type="number"
                                  min={1}
                                  value={line.quantity}
                                  onChange={(event) =>
                                    updateEditLineQuantity(
                                      line.productId,
                                      Number(event.target.value),
                                    )
                                  }
                                  className="rounded-md border border-slate-300 px-3 py-2 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeEditLine(line.productId)}
                                  className="rounded-md border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700"
                                >
                                  Retirer
                                </button>
                              </div>
                            );
                          })}
                          {editLines.length === 0 && (
                            <p className="text-xs text-slate-500">
                              Ajoute au moins un article.
                            </p>
                          )}
                        </div>
                        <p className="mt-3 text-xs text-slate-500">
                          Pour ajouter de nouveaux articles, utilise le bouton "Ajouter via catalogue".
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/catalogue?editOrder=${order.id}`)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold"
                        >
                          Ajouter via catalogue
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveOrderEdit(order.id)}
                          disabled={processingOrderId === order.id}
                          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:bg-slate-400"
                        >
                          Enregistrer modification
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOrderId(null);
                            setEditLines([]);
                          }}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
              {filteredOrders.length === 0 && (
                <p className="text-sm text-slate-600">Aucune commande pour le moment.</p>
              )}

              {sessionRole !== "ADMIN" && (
              <div className="pt-2">
                <h3 className="text-lg font-semibold">Commandes programmees</h3>
                <div className="mt-3 space-y-3">
                  {recurringOrdersState.map((item) => (
                    <article key={item.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">Recurrence {item.id}</p>
                        <p className="text-sm font-semibold">
                          {item.active ? "Active" : "Suspendue"}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        Frequence: {item.frequency} | Prochaine execution: {item.nextRunAt}
                      </p>
                      <div className="mt-2 overflow-hidden rounded-md border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100 text-slate-600">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">Produit</th>
                              <th className="px-3 py-2 text-right font-semibold">Quantite</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.lines.map((line) => (
                              <tr
                                key={`${item.id}-${line.productId}`}
                                className="border-t border-slate-200"
                              >
                                <td className="px-3 py-2">{line.productId}</td>
                                <td className="px-3 py-2 text-right">{line.quantity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  ))}
                  {recurringOrdersState.length === 0 && (
                    <p className="text-sm text-slate-600">
                      Aucune commande programmee pour le moment.
                    </p>
                  )}
                </div>
              </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
