import { products as seedProducts } from "@/data/products";
import { isDeliveryDateAllowed } from "@/lib/delivery";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  marginEuro,
  marginPercent,
  priceTtc,
  promoPriceHt,
  roundToCents,
  type Product,
} from "@/lib/pricing";

export type UserRole = "ADMIN" | "CLIENT";

export type User = {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  address: string;
  password: string;
  role: UserRole;
  deletedAt?: string;
};

export type PaymentMethod =
  | "CARD"
  | "APPLE_PAY"
  | "GOOGLE_PAY"
  | "OPEN_BANKING";

export type Payment = {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amountTtc: number;
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  transactionRef: string;
  createdAt: string;
};

export type OrderStatus =
  | "PAYEE"
  | "A_PREPARER"
  | "EN_PREPARATION"
  | "EN_LIVRAISON"
  | "LIVREE"
  | "CONFIRMEE"
  | "REMBOURSEE";

export type OrderLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceHt: number;
  unitPriceTtc: number;
  tvaRate: number;
  lineTotalHt: number;
  lineTotalTtc: number;
  lineMarginEuro: number;
  lineMarginPercent: number;
};

export type Order = {
  id: string;
  userId: string;
  status: OrderStatus;
  deliveryDate: string;
  deliveryAddress: string;
  createdAt: string;
  lines: OrderLine[];
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  paymentId: string;
  invoiceNumber: string;
  deliveryNoteNumber: string;
  receptionConfirmed: boolean;
};

export type StockMovement = {
  id: string;
  productId: string;
  change: number;
  reason: "ORDER_CONFIRMED" | "MANUAL_ADJUSTMENT";
  createdAt: string;
  relatedOrderId?: string;
};

export type RecurringOrder = {
  id: string;
  userId: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  active: boolean;
  nextRunAt: string;
  lines: Array<{ productId: string; quantity: number }>;
};

export type SupportTicket = {
  id: string;
  userId: string;
  subject: string;
  message: string;
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  createdAt: string;
};

type CheckoutInput = {
  userId: string;
  lines: Array<{ productId: string; quantity: number }>;
  paymentMethod: PaymentMethod;
  deliveryDate: string;
  deliveryAddress: string;
};

type AppState = {
  users: User[];
  products: Product[];
  payments: Payment[];
  orders: Order[];
  stockMovements: StockMovement[];
  recurringOrders: RecurringOrder[];
  supportTickets: SupportTicket[];
  monthlyFixedCosts: number;
  lowMarginPercentAlert: number;
  backups: Array<{ id: string; createdAt: string; reason: string; bytes: number }>;
};

const DATA_ROOT_PATH = process.env.VERCEL
  ? path.join("/tmp", "b2b-food-data")
  : path.join(process.cwd(), "data");

const PRODUCTS_FILE_PATH = path.join(DATA_ROOT_PATH, "products-db.json");
const USERS_FILE_PATH = path.join(DATA_ROOT_PATH, "users-db.json");
const RUNTIME_STATE_FILE_PATH = path.join(DATA_ROOT_PATH, "runtime-db.json");

type RuntimeState = {
  payments: Payment[];
  orders: Order[];
  stockMovements: StockMovement[];
  recurringOrders: RecurringOrder[];
  supportTickets: SupportTicket[];
  monthlyFixedCosts: number;
  lowMarginPercentAlert: number;
  backups: Array<{ id: string; createdAt: string; reason: string; bytes: number }>;
};

function readPersistedProducts(): Product[] | null {
  try {
    if (!fs.existsSync(PRODUCTS_FILE_PATH)) {
      return null;
    }
    const raw = fs.readFileSync(PRODUCTS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed as Product[];
  } catch {
    return null;
  }
}

function persistProducts(products: Product[]) {
  try {
    const dirPath = path.dirname(PRODUCTS_FILE_PATH);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(PRODUCTS_FILE_PATH, JSON.stringify(products, null, 2), "utf8");
  } catch (error) {
    console.warn("Persist products skipped:", error);
  }
}

function bootstrapProducts(): Product[] {
  const persisted = readPersistedProducts();
  if (persisted && persisted.length > 0) {
    return persisted;
  }
  const initial = structuredClone(seedProducts);
  persistProducts(initial);
  return initial;
}

function readPersistedUsers(): User[] | null {
  try {
    if (!fs.existsSync(USERS_FILE_PATH)) {
      return null;
    }
    const raw = fs.readFileSync(USERS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return (parsed as Array<Partial<User>>).map((item) => ({
      id: item.id ?? id("u-client"),
      companyName: item.companyName ?? "",
      email: String(item.email ?? "").toLowerCase(),
      phone: item.phone ?? "",
      address: item.address ?? "",
      password: item.password ?? "client123",
      role: item.role === "ADMIN" ? "ADMIN" : "CLIENT",
      deletedAt: item.deletedAt,
    }));
  } catch {
    return null;
  }
}

function persistUsers(users: User[]) {
  try {
    const dirPath = path.dirname(USERS_FILE_PATH);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(users, null, 2), "utf8");
  } catch (error) {
    console.warn("Persist users skipped:", error);
  }
}

function bootstrapUsers(): User[] {
  const persisted = readPersistedUsers();
  if (persisted && persisted.length > 0) {
    return persisted;
  }
  const initial: User[] = [
    {
      id: "u-admin-1",
      companyName: "So Food Service Admin",
      email: "admin@sofoodservice.local",
      phone: "",
      address: "",
      password: process.env.ADMIN_PASSWORD ?? "admin123",
      role: "ADMIN",
    },
    {
      id: "u-client-1",
      companyName: "Boulangerie Martin",
      email: "client@sofoodservice.local",
      phone: "0600000000",
      address: "Rungis, Batiment A, 94150 Rungis",
      password: process.env.CLIENT_PASSWORD ?? "client123",
      role: "CLIENT",
    },
  ];
  persistUsers(initial);
  return initial;
}

function readRuntimeState(): RuntimeState | null {
  try {
    if (!fs.existsSync(RUNTIME_STATE_FILE_PATH)) {
      return null;
    }
    const raw = fs.readFileSync(RUNTIME_STATE_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed as RuntimeState;
  } catch {
    return null;
  }
}

function persistRuntimeState(runtime: RuntimeState) {
  try {
    const dirPath = path.dirname(RUNTIME_STATE_FILE_PATH);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(RUNTIME_STATE_FILE_PATH, JSON.stringify(runtime, null, 2), "utf8");
  } catch (error) {
    console.warn("Persist runtime state skipped:", error);
  }
}

const state: AppState = {
  users: [
    ...bootstrapUsers(),
  ],
  products: bootstrapProducts(),
  payments: [],
  orders: [],
  stockMovements: [],
  recurringOrders: [],
  supportTickets: [],
  monthlyFixedCosts: 18000,
  lowMarginPercentAlert: 15,
  backups: [],
};

function getRuntimeSnapshot(): RuntimeState {
  return {
    payments: state.payments,
    orders: state.orders,
    stockMovements: state.stockMovements,
    recurringOrders: state.recurringOrders,
    supportTickets: state.supportTickets,
    monthlyFixedCosts: state.monthlyFixedCosts,
    lowMarginPercentAlert: state.lowMarginPercentAlert,
    backups: state.backups,
  };
}

function applyRuntimeSnapshot(runtime: RuntimeState) {
  state.payments = runtime.payments ?? [];
  state.orders = runtime.orders ?? [];
  state.stockMovements = runtime.stockMovements ?? [];
  state.recurringOrders = runtime.recurringOrders ?? [];
  state.supportTickets = runtime.supportTickets ?? [];
  state.monthlyFixedCosts = runtime.monthlyFixedCosts ?? 18000;
  state.lowMarginPercentAlert = runtime.lowMarginPercentAlert ?? 15;
  state.backups = runtime.backups ?? [];
}

function syncSharedStateFromDisk() {
  const persistedUsers = readPersistedUsers();
  if (persistedUsers) {
    state.users = persistedUsers;
  }
  const persistedProducts = readPersistedProducts();
  if (persistedProducts) {
    state.products = persistedProducts;
  }
  const runtime = readRuntimeState();
  if (runtime) {
    applyRuntimeSnapshot(runtime);
  }
}

function persistSharedState() {
  persistUsers(state.users);
  persistProducts(state.products);
  persistRuntimeState(getRuntimeSnapshot());
}

if (!readRuntimeState()) {
  persistRuntimeState(getRuntimeSnapshot());
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function clientIdFromEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const suffix = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 12);
  return `u-client-${suffix}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultImageForCategory(category: Product["category"]) {
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

function normalizeSubcategory(
  category: Product["category"],
  subcategory?: Product["subcategory"],
): Product["subcategory"] | undefined {
  if (!subcategory) {
    return undefined;
  }
  if (category === "Viandes") {
    if (
      subcategory === "Volailles" ||
      subcategory === "Viandes blanches" ||
      subcategory === "Viandes rouges"
    ) {
      return subcategory;
    }
    return undefined;
  }
  if (category === "Boissons") {
    if (subcategory === "Eau" || subcategory === "Jus" || subcategory === "Soda") {
      return subcategory;
    }
    return undefined;
  }
  return undefined;
}

function paymentSuccessRate(method: PaymentMethod): number {
  if (method === "OPEN_BANKING") {
    return 0.96;
  }
  return 0.99;
}

function processPayment(method: PaymentMethod): { ok: boolean; transactionRef: string } {
  const ok = Math.random() < paymentSuccessRate(method);
  return {
    ok,
    transactionRef: `TRX-${Date.now()}`,
  };
}

export function listProducts() {
  syncSharedStateFromDisk();
  return state.products;
}

export function addAdminProduct(input: {
  name: string;
  origin: string;
  category: Product["category"];
  subcategory?: Product["subcategory"];
  pricingUnit: Product["pricingUnit"];
  priceHt: number;
  buyPriceHt?: number;
  tvaRate?: number;
  stock?: number;
  description?: string;
  image?: string;
}): Product {
  syncSharedStateFromDisk();
  if (!input.name?.trim()) {
    throw new Error("Le nom du produit est obligatoire.");
  }
  if (!input.origin?.trim()) {
    throw new Error("L'origine du produit est obligatoire.");
  }
  if (input.priceHt <= 0) {
    throw new Error("Le prix doit etre superieur a 0.");
  }

  const product: Product = {
    id: id("prd"),
    name: input.name.trim(),
    description:
      input.description?.trim() ||
      `${input.name.trim()} pour professionnels, origine ${input.origin.trim()}.`,
    category: input.category,
    subcategory: normalizeSubcategory(input.category, input.subcategory),
    origin: input.origin.trim(),
    pricingUnit: input.pricingUnit,
    image: input.image || defaultImageForCategory(input.category),
    priceHt: roundToCents(input.priceHt),
    buyPriceHt: roundToCents(input.buyPriceHt ?? input.priceHt * 0.72),
    tvaRate: input.tvaRate ?? 5.5,
    stock: Math.max(0, Math.floor(input.stock ?? 50)),
    isFeatured: false,
    isSlowMover: false,
  };

  state.products.unshift(product);
  persistSharedState();
  return product;
}

export function updateAdminProduct(
  productId: string,
  input: Partial<{
    name: string;
    origin: string;
    category: Product["category"];
    subcategory: Product["subcategory"];
    pricingUnit: Product["pricingUnit"];
    priceHt: number;
    buyPriceHt: number;
    tvaRate: number;
    stock: number;
    description: string;
    image: string;
    isFeatured: boolean;
    isSlowMover: boolean;
    promoPercent: number;
  }>,
): Product {
  syncSharedStateFromDisk();
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    throw new Error("Produit introuvable.");
  }

  if (typeof input.name === "string") {
    const value = input.name.trim();
    if (!value) {
      throw new Error("Le nom du produit est obligatoire.");
    }
    product.name = value;
  }

  if (typeof input.origin === "string") {
    product.origin = input.origin.trim() || "Origine non precisee";
  }

  if (typeof input.category === "string") {
    product.category = input.category;
    product.subcategory = normalizeSubcategory(product.category, product.subcategory);
  }

  if (typeof input.subcategory === "string") {
    product.subcategory = normalizeSubcategory(product.category, input.subcategory);
  }

  if (typeof input.pricingUnit === "string") {
    product.pricingUnit = input.pricingUnit;
  }

  if (typeof input.priceHt === "number") {
    if (input.priceHt <= 0) {
      throw new Error("Le prix doit etre superieur a 0.");
    }
    product.priceHt = roundToCents(input.priceHt);
  }

  if (typeof input.buyPriceHt === "number") {
    product.buyPriceHt = roundToCents(Math.max(0, input.buyPriceHt));
  }

  if (typeof input.tvaRate === "number") {
    product.tvaRate = input.tvaRate;
  }

  if (typeof input.stock === "number") {
    product.stock = Math.max(0, Math.floor(input.stock));
  }

  if (typeof input.description === "string") {
    product.description = input.description.trim() || product.description;
  }

  if (typeof input.image === "string") {
    product.image = input.image.trim() || defaultImageForCategory(product.category);
  }

  if (typeof input.isFeatured === "boolean") {
    product.isFeatured = input.isFeatured;
  }

  if (typeof input.isSlowMover === "boolean") {
    product.isSlowMover = input.isSlowMover;
  }

  if (typeof input.promoPercent === "number") {
    if (input.promoPercent > 0) {
      product.promoPercent = input.promoPercent;
    } else {
      delete product.promoPercent;
    }
  }

  persistSharedState();
  return product;
}

export function deleteAdminProduct(productId: string) {
  syncSharedStateFromDisk();
  const index = state.products.findIndex((item) => item.id === productId);
  if (index < 0) {
    throw new Error("Produit introuvable.");
  }
  const [removed] = state.products.splice(index, 1);
  persistSharedState();
  return removed;
}

export function listOrdersByUser(userId: string): Order[] {
  syncSharedStateFromDisk();
  return state.orders.filter((order) => order.userId === userId);
}

export function listAllOrders(): Order[] {
  syncSharedStateFromDisk();
  return state.orders;
}

export function getOrderById(orderId: string): Order | undefined {
  syncSharedStateFromDisk();
  return state.orders.find((order) => order.id === orderId);
}

export function createCheckout(input: CheckoutInput): Order {
  syncSharedStateFromDisk();
  if (!isDeliveryDateAllowed(input.deliveryDate)) {
    throw new Error("La date de livraison ne respecte pas la regle J+1/J+2.");
  }

  if (!input.lines.length) {
    throw new Error("Le panier est vide.");
  }
  if (!input.deliveryAddress?.trim()) {
    throw new Error("L'adresse de livraison est obligatoire.");
  }

  const lines: OrderLine[] = input.lines.map((line) => {
    const product = state.products.find((item) => item.id === line.productId);
    if (!product) {
      throw new Error(`Produit introuvable: ${line.productId}`);
    }
    if (line.quantity <= 0) {
      throw new Error("Quantite invalide.");
    }
    if (product.stock < line.quantity) {
      throw new Error(`Stock insuffisant pour ${product.name}.`);
    }

    const finalUnitHt = promoPriceHt(product.priceHt, product.promoPercent);
    const unitTtc = priceTtc(finalUnitHt, product.tvaRate);
    const lineTotalHt = roundToCents(finalUnitHt * line.quantity);
    const lineTotalTtc = roundToCents(unitTtc * line.quantity);
    const lineMarginEuro = marginEuro(finalUnitHt, product.buyPriceHt, line.quantity);
    const lineMarginPercent = marginPercent(finalUnitHt, product.buyPriceHt);

    return {
      productId: product.id,
      productName: product.name,
      quantity: line.quantity,
      unitPriceHt: finalUnitHt,
      unitPriceTtc: unitTtc,
      tvaRate: product.tvaRate,
      lineTotalHt,
      lineTotalTtc,
      lineMarginEuro,
      lineMarginPercent,
    };
  });

  const totalHt = roundToCents(lines.reduce((sum, line) => sum + line.lineTotalHt, 0));
  const totalTtc = roundToCents(lines.reduce((sum, line) => sum + line.lineTotalTtc, 0));
  const totalTva = roundToCents(totalTtc - totalHt);

  const paymentResult = processPayment(input.paymentMethod);
  if (!paymentResult.ok) {
    throw new Error("Paiement refuse par le prestataire.");
  }

  const orderId = id("ord");
  const paymentId = id("pay");
  const createdAt = nowIso();

  const payment: Payment = {
    id: paymentId,
    orderId,
    method: input.paymentMethod,
    amountTtc: totalTtc,
    status: "PAID",
    transactionRef: paymentResult.transactionRef,
    createdAt,
  };

  for (const line of lines) {
    const product = state.products.find((item) => item.id === line.productId);
    if (!product) {
      continue;
    }

    product.stock -= line.quantity;
    state.stockMovements.push({
      id: id("stm"),
      productId: product.id,
      change: -line.quantity,
      reason: "ORDER_CONFIRMED",
      relatedOrderId: orderId,
      createdAt,
    });
  }
  persistSharedState();

  const invoiceIndex = state.orders.length + 1;
  const order: Order = {
    id: orderId,
    userId: input.userId,
    status: "A_PREPARER",
    deliveryDate: input.deliveryDate,
    deliveryAddress: input.deliveryAddress.trim(),
    createdAt,
    lines,
    totalHt,
    totalTva,
    totalTtc,
    paymentId: payment.id,
    invoiceNumber: `FAC-${new Date().getFullYear()}-${String(invoiceIndex).padStart(5, "0")}`,
    deliveryNoteNumber: `BL-${new Date().getFullYear()}-${String(invoiceIndex).padStart(5, "0")}`,
    receptionConfirmed: false,
  };

  state.payments.push(payment);
  state.orders.push(order);
  persistSharedState();
  return order;
}

export function createRecurringOrder(input: {
  userId: string;
  frequency: RecurringOrder["frequency"];
  nextRunAt: string;
  lines: Array<{ productId: string; quantity: number }>;
}): RecurringOrder {
  syncSharedStateFromDisk();
  const recurring: RecurringOrder = {
    id: id("rec"),
    userId: input.userId,
    frequency: input.frequency,
    active: true,
    nextRunAt: input.nextRunAt,
    lines: input.lines,
  };
  state.recurringOrders.push(recurring);
  persistSharedState();
  return recurring;
}

export function listRecurringOrdersByUser(userId: string): RecurringOrder[] {
  syncSharedStateFromDisk();
  return state.recurringOrders.filter((item) => item.userId === userId);
}

export function listAllRecurringOrders(): RecurringOrder[] {
  syncSharedStateFromDisk();
  return state.recurringOrders;
}

export function setRecurringOrderStatus(recurringId: string, active: boolean): RecurringOrder {
  syncSharedStateFromDisk();
  const recurring = state.recurringOrders.find((item) => item.id === recurringId);
  if (!recurring) {
    throw new Error("Commande recurrente introuvable.");
  }
  recurring.active = active;
  persistSharedState();
  return recurring;
}

export function createTicket(input: {
  userId: string;
  subject: string;
  message: string;
}): SupportTicket {
  syncSharedStateFromDisk();
  const ticket: SupportTicket = {
    id: id("sup"),
    userId: input.userId,
    subject: input.subject,
    message: input.message,
    status: "OPEN",
    createdAt: nowIso(),
  };
  state.supportTickets.push(ticket);
  persistSharedState();
  return ticket;
}

export function listTicketsByUser(userId: string): SupportTicket[] {
  syncSharedStateFromDisk();
  return state.supportTickets.filter((item) => item.userId === userId);
}

export function listAllTickets(): SupportTicket[] {
  syncSharedStateFromDisk();
  return state.supportTickets;
}

export function updateOrderStatus(orderId: string, status: OrderStatus): Order {
  syncSharedStateFromDisk();
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) {
    throw new Error("Commande introuvable.");
  }
  order.status = status;
  persistSharedState();
  return order;
}

export function confirmReception(orderId: string): Order {
  syncSharedStateFromDisk();
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) {
    throw new Error("Commande introuvable.");
  }
  order.receptionConfirmed = true;
  order.status = "CONFIRMEE";
  persistSharedState();
  return order;
}

export function adminDashboard() {
  syncSharedStateFromDisk();
  const totalRevenue = roundToCents(state.orders.reduce((sum, order) => sum + order.totalTtc, 0));
  const totalMargin = roundToCents(
    state.orders.reduce(
      (sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + line.lineMarginEuro, 0),
      0,
    ),
  );

  const productMargins = state.products.map((product) => {
    const sellHt = promoPriceHt(product.priceHt, product.promoPercent);
    const marginPct = marginPercent(sellHt, product.buyPriceHt);
    return {
      productId: product.id,
      productName: product.name,
      marginPercent: marginPct,
      belowThreshold: marginPct < state.lowMarginPercentAlert,
      lossMaking: sellHt < product.buyPriceHt,
    };
  });

  const breakEvenRevenue = state.monthlyFixedCosts;
  return {
    totalRevenue,
    totalMargin,
    breakEvenRevenue,
    lowMarginPercentAlert: state.lowMarginPercentAlert,
    productMargins,
    ordersCount: state.orders.length,
    stockAlerts: state.products.filter((product) => product.stock <= 5).length,
    supportOpenTickets: state.supportTickets.filter((ticket) => ticket.status !== "CLOSED").length,
  };
}

export function listStockMovements(): StockMovement[] {
  syncSharedStateFromDisk();
  return state.stockMovements;
}

export function setMonthlyFixedCosts(value: number): number {
  syncSharedStateFromDisk();
  if (value < 0) {
    throw new Error("Les charges fixes ne peuvent pas etre negatives.");
  }
  state.monthlyFixedCosts = roundToCents(value);
  persistSharedState();
  return state.monthlyFixedCosts;
}

export function getCurrentClientUser(): User {
  syncSharedStateFromDisk();
  return state.users.find((user) => user.role === "CLIENT" && !user.deletedAt) ?? state.users[0];
}

export function getUserById(userId: string): User | undefined {
  syncSharedStateFromDisk();
  return state.users.find((user) => user.id === userId);
}

export function getUserByEmail(email: string): User | undefined {
  syncSharedStateFromDisk();
  return state.users.find((user) => {
    if (user.email.toLowerCase() !== email.trim().toLowerCase()) {
      return false;
    }
    if (user.role === "CLIENT" && user.deletedAt) {
      return false;
    }
    return true;
  });
}

export function listClientUsers() {
  syncSharedStateFromDisk();
  return state.users
    .filter((user) => user.role === "CLIENT" && !user.deletedAt)
    .map((user) => ({
      id: user.id,
      companyName: user.companyName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
    }));
}

export function listDeletedClientUsers() {
  syncSharedStateFromDisk();
  return state.users
    .filter((user) => user.role === "CLIENT" && Boolean(user.deletedAt))
    .map((user) => ({
      id: user.id,
      companyName: user.companyName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
      deletedAt: user.deletedAt,
    }));
}

export function createClientUser(input: {
  companyName: string;
  email: string;
  phone: string;
  address: string;
  password: string;
}) {
  syncSharedStateFromDisk();
  const companyName = input.companyName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const address = input.address.trim();
  const password = input.password;

  if (!companyName) {
    throw new Error("Le nom de l'entreprise est obligatoire.");
  }
  if (!email || !email.includes("@")) {
    throw new Error("Email invalide.");
  }
  if (!phone) {
    throw new Error("Le numero de telephone est obligatoire.");
  }
  if (!password || password.length < 6) {
    throw new Error("Le mot de passe doit contenir au moins 6 caracteres.");
  }
  if (!address) {
    throw new Error("L'adresse de livraison est obligatoire.");
  }
  if (state.users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error("Un compte existe deja avec cet email.");
  }

  const client: User = {
    id: clientIdFromEmail(email),
    companyName,
    email,
    phone,
    address,
    password,
    role: "CLIENT",
  };
  state.users.push(client);
  persistSharedState();
  return client;
}

export function ensureClientUserByEmail(
  email: string,
  defaults?: Partial<Pick<User, "companyName" | "phone" | "address" | "password">>,
): User {
  syncSharedStateFromDisk();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("Email client invalide.");
  }

  const existing = state.users.find(
    (item) => item.role === "CLIENT" && item.email.toLowerCase() === normalizedEmail,
  );
  if (existing) {
    if (existing.deletedAt) {
      delete existing.deletedAt;
      persistSharedState();
    }
    return existing;
  }

  const localPart = normalizedEmail.split("@")[0] || "client";
  const generatedCompany = localPart.replace(/[._-]+/g, " ").trim() || "Nouveau client";
  const user: User = {
    id: clientIdFromEmail(normalizedEmail),
    companyName: (defaults?.companyName ?? generatedCompany).trim(),
    email: normalizedEmail,
    phone: (defaults?.phone ?? "").trim(),
    address: (defaults?.address ?? "").trim(),
    password: defaults?.password ?? process.env.CLIENT_PASSWORD ?? "client123",
    role: "CLIENT",
  };
  state.users.push(user);
  persistSharedState();
  return user;
}

export function verifyClientCredentials(email: string, password: string): User | null {
  syncSharedStateFromDisk();
  const normalizedEmail = email.trim().toLowerCase();
  const user = state.users.find(
    (item) =>
      item.role === "CLIENT" &&
      !item.deletedAt &&
      item.email.toLowerCase() === normalizedEmail,
  );
  if (!user || user.password !== password) {
    return null;
  }
  return user;
}

export function deleteClientUser(userId: string): User {
  syncSharedStateFromDisk();
  const user = state.users.find((item) => item.id === userId);
  if (!user || user.role !== "CLIENT") {
    throw new Error("Client introuvable.");
  }
  if (!user.deletedAt) {
    user.deletedAt = nowIso();
    persistSharedState();
  }
  return user;
}

export function clientOverview(userId: string) {
  syncSharedStateFromDisk();
  const orders = listOrdersByUser(userId);
  const completedStatuses: OrderStatus[] = ["LIVREE", "CONFIRMEE", "REMBOURSEE"];

  const ongoingOrders = orders.filter(
    (order) => !completedStatuses.includes(order.status),
  ).length;
  const pastOrders = orders.filter((order) =>
    completedStatuses.includes(order.status),
  ).length;

  const quantitiesByProduct = new Map<
    string,
    { productName: string; quantity: number }
  >();

  for (const order of orders) {
    for (const line of order.lines) {
      const current = quantitiesByProduct.get(line.productId);
      if (!current) {
        quantitiesByProduct.set(line.productId, {
          productName: line.productName,
          quantity: line.quantity,
        });
      } else {
        current.quantity += line.quantity;
      }
    }
  }

  const frequentItems = Array.from(quantitiesByProduct.entries())
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 5)
    .map(([productId, item]) => ({
      productId,
      productName: item.productName,
      quantity: item.quantity,
    }));

  return {
    totalOrders: orders.length,
    ongoingOrders,
    pastOrders,
    frequentItems,
  };
}

export function createBackup(reason: string) {
  syncSharedStateFromDisk();
  const snapshot = JSON.stringify({
    createdAt: nowIso(),
    users: state.users,
    products: state.products,
    orders: state.orders,
    payments: state.payments,
    stockMovements: state.stockMovements,
    recurringOrders: state.recurringOrders,
    supportTickets: state.supportTickets,
  });
  const bytes = Buffer.byteLength(snapshot, "utf8");
  const backup = {
    id: id("bkp"),
    createdAt: nowIso(),
    reason,
    bytes,
  };
  state.backups.unshift(backup);
  persistSharedState();
  return { backup, snapshot };
}

export function listBackups() {
  syncSharedStateFromDisk();
  return state.backups;
}
