import { products as seedProducts } from "@/data/products";
import { isDeliveryDateAllowed } from "@/lib/delivery";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Client, Pool, type QueryResultRow } from "pg";
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
  | "REMBOURSEE"
  | "ANNULEE";

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
  clientCompany?: string;
  clientEmail?: string;
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
  deliveryAddress?: string;
  paymentMethod?: PaymentMethod;
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
const DB_STATE_KEY = "primary";

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

type PersistedDbState = {
  users: User[];
  products: Product[];
  runtime: RuntimeState;
};

type QueryPrimitive = string | number | boolean | undefined | null;

let dbSchemaReady: Promise<void> | null = null;
let lastDatabaseReadFailed = false;
let forceDirectClient = false;
let disableDatabaseForRuntime = false;
let pooledClient: Pool | null = null;

function getDatabaseConnectionString() {
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_POSTGRES_URL ||
    process.env.DATABASE_URL_PRISMA_DATABASE_URL ||
    ""
  );
}

function getDirectDatabaseConnectionString() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    ""
  );
}

function isDatabaseEnabled() {
  return (
    !disableDatabaseForRuntime &&
    Boolean(getDatabaseConnectionString() || getDirectDatabaseConnectionString())
  );
}

function isInvalidConnectionStringError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const maybeCode = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const maybeMessage =
    "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return (
    maybeCode === "invalid_connection_string" ||
    maybeCode === "ENOTFOUND" ||
    maybeCode === "ECONNREFUSED" ||
    maybeMessage.toLowerCase().includes("connection string") ||
    maybeMessage.toLowerCase().includes("direct connection")
  );
}

function compileDbQuery(strings: TemplateStringsArray, values: QueryPrimitive[]) {
  let text = "";
  for (let index = 0; index < strings.length; index += 1) {
    text += strings[index];
    if (index < values.length) {
      text += `$${index + 1}`;
    }
  }
  return { text, values };
}

function getOrCreatePool(connectionString: string) {
  if (pooledClient) {
    return pooledClient;
  }
  pooledClient = new Pool({ connectionString });
  return pooledClient;
}

async function runDbQuery<T extends QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: QueryPrimitive[]
): Promise<{ rows: T[] }> {
  const query = compileDbQuery(strings, values);

  if (!forceDirectClient) {
    try {
      const pooledConnection = getDatabaseConnectionString() || getDirectDatabaseConnectionString();
      if (!pooledConnection) {
        throw new Error("Missing database connection string.");
      }
      const pool = getOrCreatePool(pooledConnection);
      const result = await pool.query(query.text, query.values);
      return { rows: result.rows as T[] };
    } catch (error) {
      if (!isInvalidConnectionStringError(error)) {
        throw error;
      }
      forceDirectClient = true;
      console.warn(
        "Pooled query unavailable, falling back to direct postgres client for this runtime.",
      );
    }
  }

  const connectionString = getDirectDatabaseConnectionString() || getDatabaseConnectionString();
  if (!connectionString) {
    throw new Error("Missing database connection string.");
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(query.text, query.values);
    return { rows: result.rows as T[] };
  } catch (error) {
    if (isInvalidConnectionStringError(error)) {
      disableDatabaseForRuntime = true;
    }
    throw error;
  } finally {
    await client.end();
  }
}

export function getStorageStatus() {
  const vercel = Boolean(process.env.VERCEL);
  const database = isDatabaseEnabled();
  return {
    vercel,
    database,
    durable: !vercel || database,
    message:
      !vercel || database
        ? "Stockage durable actif."
        : "Stockage non durable sur Vercel: configure DATABASE_URL (ou POSTGRES_URL).",
  };
}

async function ensureDbSchema() {
  if (!isDatabaseEnabled()) {
    return;
  }
  if (!dbSchemaReady) {
    dbSchemaReady = (async () => {
      await runDbQuery`
        CREATE TABLE IF NOT EXISTS app_state (
          key TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
    })();
  }
  await dbSchemaReady;
}

async function readDatabaseState(): Promise<PersistedDbState | null> {
  if (!isDatabaseEnabled()) {
    lastDatabaseReadFailed = false;
    return null;
  }
  try {
    lastDatabaseReadFailed = false;
    await ensureDbSchema();
    const result = await runDbQuery<{ data: PersistedDbState }>`
      SELECT data
      FROM app_state
      WHERE key = ${DB_STATE_KEY}
      LIMIT 1
    `;
    if (!result.rows.length) {
      return null;
    }
    return result.rows[0].data ?? null;
  } catch (error) {
    if (isInvalidConnectionStringError(error)) {
      disableDatabaseForRuntime = true;
      lastDatabaseReadFailed = false;
      console.warn("Database connection string is not compatible with postgres runtime. Falling back to file storage.");
      return null;
    }
    lastDatabaseReadFailed = true;
    console.warn("Read database state failed:", error);
    return null;
  }
}

async function persistDatabaseState(snapshot: PersistedDbState) {
  if (!isDatabaseEnabled()) {
    return;
  }
  try {
    await ensureDbSchema();
    const json = JSON.stringify(snapshot);
    await runDbQuery`
      INSERT INTO app_state (key, data, updated_at)
      VALUES (${DB_STATE_KEY}, ${json}::jsonb, NOW())
      ON CONFLICT (key)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
  } catch (error) {
    if (isInvalidConnectionStringError(error)) {
      disableDatabaseForRuntime = true;
    }
    throw error;
  }
}

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

async function syncSharedStateFromDisk() {
  const dbState = await readDatabaseState();
  if (dbState) {
    state.users = Array.isArray(dbState.users) ? dbState.users : state.users;
    state.products = Array.isArray(dbState.products) ? dbState.products : state.products;
    if (dbState.runtime) {
      applyRuntimeSnapshot(dbState.runtime);
    }
    await materializeRecurringOrders();
    return;
  }
  if (isDatabaseEnabled() && lastDatabaseReadFailed) {
    // Do not overwrite remote DB with local fallback when DB read failed transiently.
    return;
  }

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

  await materializeRecurringOrders();

  if (isDatabaseEnabled()) {
    try {
      await persistDatabaseState({
        users: state.users,
        products: state.products,
        runtime: getRuntimeSnapshot(),
      });
    } catch (error) {
      console.warn("Database sync failed, continuing with file fallback:", error);
    }
  }
}

async function persistSharedState() {
  if (isDatabaseEnabled()) {
    try {
      await persistDatabaseState({
        users: state.users,
        products: state.products,
        runtime: getRuntimeSnapshot(),
      });
      return;
    } catch (error) {
      console.warn("Database persist failed, using file fallback:", error);
    }
  }
  persistUsers(state.users);
  persistProducts(state.products);
  persistRuntimeState(getRuntimeSnapshot());
}

if (!isDatabaseEnabled() && !readRuntimeState()) {
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

function isOrderTerminal(status: OrderStatus) {
  return status === "LIVREE" || status === "CONFIRMEE" || status === "REMBOURSEE" || status === "ANNULEE";
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

export async function listProducts() {
  await syncSharedStateFromDisk();
  return state.products;
}

export async function addAdminProduct(input: {
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
}): Promise<Product> {
  await syncSharedStateFromDisk();
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
  try {
    await persistSharedState();
  } catch (error) {
    state.products = state.products.filter((item) => item.id !== product.id);
    throw error;
  }
  return product;
}

export async function updateAdminProduct(
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
): Promise<Product> {
  await syncSharedStateFromDisk();
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

  await persistSharedState();
  return product;
}

export async function deleteAdminProduct(productId: string) {
  await syncSharedStateFromDisk();
  const index = state.products.findIndex((item) => item.id === productId);
  if (index < 0) {
    throw new Error("Produit introuvable.");
  }
  const [removed] = state.products.splice(index, 1);
  await persistSharedState();
  return removed;
}

export async function listOrdersByUser(userId: string): Promise<Order[] > {
  await syncSharedStateFromDisk();
  return state.orders.filter((order) => order.userId === userId);
}

export async function listAllOrders(): Promise<Order[] > {
  await syncSharedStateFromDisk();
  return state.orders;
}

export async function getOrderById(orderId: string): Promise<Order | undefined > {
  await syncSharedStateFromDisk();
  return state.orders.find((order) => order.id === orderId);
}

export async function createCheckout(input: CheckoutInput): Promise<Order > {
  await syncSharedStateFromDisk();
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
  await persistSharedState();

  const invoiceIndex = state.orders.length + 1;
  const clientUser = state.users.find((item) => item.id === input.userId);
  const order: Order = {
    id: orderId,
    userId: input.userId,
    clientCompany: clientUser?.companyName,
    clientEmail: clientUser?.email,
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
  await persistSharedState();
  return order;
}

export async function createRecurringOrder(input: {
  userId: string;
  frequency: RecurringOrder["frequency"];
  nextRunAt: string;
  deliveryAddress?: string;
  paymentMethod?: PaymentMethod;
  lines: Array<{ productId: string; quantity: number }>;
}): Promise<RecurringOrder> {
  await syncSharedStateFromDisk();
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error("La recurrence doit contenir au moins un article.");
  }
  const recurring: RecurringOrder = {
    id: id("rec"),
    userId: input.userId,
    frequency: input.frequency,
    active: true,
    nextRunAt: input.nextRunAt,
    deliveryAddress: input.deliveryAddress?.trim() || undefined,
    paymentMethod: input.paymentMethod,
    lines: input.lines,
  };
  state.recurringOrders.push(recurring);
  await persistSharedState();
  return recurring;
}

export async function listRecurringOrdersByUser(userId: string): Promise<RecurringOrder[] > {
  await syncSharedStateFromDisk();
  return state.recurringOrders.filter((item) => item.userId === userId);
}

export async function listAllRecurringOrders(): Promise<RecurringOrder[] > {
  await syncSharedStateFromDisk();
  return state.recurringOrders;
}

export async function setRecurringOrderStatus(recurringId: string, active: boolean): Promise<RecurringOrder > {
  await syncSharedStateFromDisk();
  const recurring = state.recurringOrders.find((item) => item.id === recurringId);
  if (!recurring) {
    throw new Error("Commande recurrente introuvable.");
  }
  recurring.active = active;
  await persistSharedState();
  return recurring;
}

function getNextRunAt(currentRunAt: string, frequency: RecurringOrder["frequency"]) {
  const value = new Date(currentRunAt);
  if (Number.isNaN(value.getTime())) {
    return nowIso();
  }
  if (frequency === "DAILY") {
    value.setUTCDate(value.getUTCDate() + 1);
  } else if (frequency === "WEEKLY") {
    value.setUTCDate(value.getUTCDate() + 7);
  } else {
    value.setUTCMonth(value.getUTCMonth() + 1);
  }
  return value.toISOString();
}

function getNextAllowedDeliveryDate(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setHours(19, 0, 0, 0);
  const plusDays = now <= cutoff ? 1 : 2;
  const delivery = new Date(now);
  delivery.setDate(now.getDate() + plusDays);
  return delivery.toISOString().split("T")[0];
}

async function materializeRecurringOrders() {
  const now = Date.now();
  let hasChanges = false;

  for (const recurring of state.recurringOrders) {
    if (!recurring.active) {
      continue;
    }
    const user = state.users.find(
      (item) => item.id === recurring.userId && item.role === "CLIENT" && !item.deletedAt,
    );
    if (!user) {
      recurring.active = false;
      hasChanges = true;
      continue;
    }

    let guard = 0;
    while (guard < 24) {
      guard += 1;
      const runAt = new Date(recurring.nextRunAt);
      if (Number.isNaN(runAt.getTime()) || runAt.getTime() > now) {
        break;
      }

      const runDate = runAt.toISOString().split("T")[0];
      const deliveryDate = isDeliveryDateAllowed(runDate) ? runDate : getNextAllowedDeliveryDate();
      try {
        if (!recurring.lines.length) {
          throw new Error("Recurrence vide");
        }

        const lines: OrderLine[] = recurring.lines.map((line) => {
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
          return {
            productId: product.id,
            productName: product.name,
            quantity: line.quantity,
            unitPriceHt: finalUnitHt,
            unitPriceTtc: unitTtc,
            tvaRate: product.tvaRate,
            lineTotalHt: roundToCents(finalUnitHt * line.quantity),
            lineTotalTtc: roundToCents(unitTtc * line.quantity),
            lineMarginEuro: marginEuro(finalUnitHt, product.buyPriceHt, line.quantity),
            lineMarginPercent: marginPercent(finalUnitHt, product.buyPriceHt),
          } satisfies OrderLine;
        });

        const totalHt = roundToCents(lines.reduce((sum, line) => sum + line.lineTotalHt, 0));
        const totalTtc = roundToCents(lines.reduce((sum, line) => sum + line.lineTotalTtc, 0));
        const totalTva = roundToCents(totalTtc - totalHt);
        const orderId = id("ord");
        const paymentId = id("pay");
        const createdAt = nowIso();

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

        const invoiceIndex = state.orders.length + 1;
        state.payments.push({
          id: paymentId,
          orderId,
          method: recurring.paymentMethod ?? "CARD",
          amountTtc: totalTtc,
          status: "PAID",
          transactionRef: `AUTO-${Date.now()}`,
          createdAt,
        });
        state.orders.push({
          id: orderId,
          userId: user.id,
          clientCompany: user.companyName,
          clientEmail: user.email,
          status: "A_PREPARER",
          deliveryDate,
          deliveryAddress: recurring.deliveryAddress || user.address || "Adresse non precisee",
          createdAt,
          lines,
          totalHt,
          totalTva,
          totalTtc,
          paymentId,
          invoiceNumber: `FAC-${new Date().getFullYear()}-${String(invoiceIndex).padStart(5, "0")}`,
          deliveryNoteNumber: `BL-${new Date().getFullYear()}-${String(invoiceIndex).padStart(5, "0")}`,
          receptionConfirmed: false,
        });
        hasChanges = true;
      } catch {
        // If one scheduled run fails, still advance to avoid infinite loops.
      }

      recurring.nextRunAt = getNextRunAt(recurring.nextRunAt, recurring.frequency);
      hasChanges = true;
    }
  }

  if (hasChanges) {
    await persistSharedState();
  }
}

export async function createTicket(input: {
  userId: string;
  subject: string;
  message: string;
}): Promise<SupportTicket> {
  await syncSharedStateFromDisk();
  const ticket: SupportTicket = {
    id: id("sup"),
    userId: input.userId,
    subject: input.subject,
    message: input.message,
    status: "OPEN",
    createdAt: nowIso(),
  };
  state.supportTickets.push(ticket);
  await persistSharedState();
  return ticket;
}

export async function listTicketsByUser(userId: string): Promise<SupportTicket[] > {
  await syncSharedStateFromDisk();
  return state.supportTickets.filter((item) => item.userId === userId);
}

export async function listAllTickets(): Promise<SupportTicket[] > {
  await syncSharedStateFromDisk();
  return state.supportTickets;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order > {
  await syncSharedStateFromDisk();
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) {
    throw new Error("Commande introuvable.");
  }
  order.status = status;
  await persistSharedState();
  return order;
}

export async function confirmReception(orderId: string): Promise<Order > {
  await syncSharedStateFromDisk();
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) {
    throw new Error("Commande introuvable.");
  }
  order.receptionConfirmed = true;
  order.status = "CONFIRMEE";
  await persistSharedState();
  return order;
}

export async function adminDashboard() {
  await syncSharedStateFromDisk();
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

export async function listStockMovements(): Promise<StockMovement[] > {
  await syncSharedStateFromDisk();
  return state.stockMovements;
}

export async function setMonthlyFixedCosts(value: number): Promise<number > {
  await syncSharedStateFromDisk();
  if (value < 0) {
    throw new Error("Les charges fixes ne peuvent pas etre negatives.");
  }
  state.monthlyFixedCosts = roundToCents(value);
  await persistSharedState();
  return state.monthlyFixedCosts;
}

export async function getCurrentClientUser(): Promise<User > {
  await syncSharedStateFromDisk();
  return state.users.find((user) => user.role === "CLIENT" && !user.deletedAt) ?? state.users[0];
}

export async function getUserById(userId: string): Promise<User | undefined > {
  await syncSharedStateFromDisk();
  return state.users.find((user) => user.id === userId);
}

export async function getUserByEmail(email: string): Promise<User | undefined > {
  await syncSharedStateFromDisk();
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

export async function listClientUsers() {
  await syncSharedStateFromDisk();
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

export async function listDeletedClientUsers() {
  await syncSharedStateFromDisk();
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
      cancelledOrdersCount: state.orders.filter(
        (order) => order.userId === user.id && order.status === "ANNULEE",
      ).length,
    }));
}

export async function createClientUser(input: {
  companyName: string;
  email: string;
  phone: string;
  address: string;
  password: string;
}) {
  await syncSharedStateFromDisk();
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
  const existingByEmail = state.users.find((user) => user.email.toLowerCase() === email);
  if (existingByEmail) {
    if (existingByEmail.role !== "CLIENT") {
      throw new Error("Un compte existe deja avec cet email.");
    }
    if (!existingByEmail.deletedAt) {
      throw new Error("Un compte existe deja avec cet email.");
    }

    const previous = {
      companyName: existingByEmail.companyName,
      phone: existingByEmail.phone,
      address: existingByEmail.address,
      password: existingByEmail.password,
      deletedAt: existingByEmail.deletedAt,
    };
    existingByEmail.companyName = companyName;
    existingByEmail.phone = phone;
    existingByEmail.address = address;
    existingByEmail.password = password;
    delete existingByEmail.deletedAt;
    try {
      await persistSharedState();
    } catch (error) {
      existingByEmail.companyName = previous.companyName;
      existingByEmail.phone = previous.phone;
      existingByEmail.address = previous.address;
      existingByEmail.password = previous.password;
      existingByEmail.deletedAt = previous.deletedAt;
      throw error;
    }
    return existingByEmail;
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
  try {
    await persistSharedState();
  } catch (error) {
    state.users = state.users.filter((item) => item.id !== client.id);
    throw error;
  }
  return client;
}

export async function ensureClientUserByEmail(
  email: string,
  defaults?: Partial<Pick<User, "companyName" | "phone" | "address" | "password">>,
): Promise<User > {
  await syncSharedStateFromDisk();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("Email client invalide.");
  }

  const existing = state.users.find(
    (item) => item.role === "CLIENT" && item.email.toLowerCase() === normalizedEmail,
  );
  if (existing) {
    if (existing.deletedAt) {
      const previousDeletedAt = existing.deletedAt;
      delete existing.deletedAt;
      try {
        await persistSharedState();
      } catch (error) {
        existing.deletedAt = previousDeletedAt;
        throw error;
      }
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
  try {
    await persistSharedState();
  } catch (error) {
    state.users = state.users.filter((item) => item.id !== user.id);
    throw error;
  }
  return user;
}

export async function verifyClientCredentials(email: string, password: string): Promise<User | null > {
  await syncSharedStateFromDisk();
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

export async function deleteClientUser(userId: string): Promise<User > {
  await syncSharedStateFromDisk();
  const user = state.users.find((item) => item.id === userId);
  if (!user || user.role !== "CLIENT") {
    throw new Error("Client introuvable.");
  }
  if (!user.deletedAt) {
    user.deletedAt = nowIso();
    for (const order of state.orders) {
      if (order.userId === userId && !isOrderTerminal(order.status)) {
        order.status = "ANNULEE";
      }
    }
    for (const recurring of state.recurringOrders) {
      if (recurring.userId === userId) {
        recurring.active = false;
      }
    }
    await persistSharedState();
  }
  return user;
}

export async function restoreClientUser(userId: string): Promise<User> {
  await syncSharedStateFromDisk();
  const user = state.users.find((item) => item.id === userId);
  if (!user || user.role !== "CLIENT") {
    throw new Error("Client introuvable.");
  }
  if (user.deletedAt) {
    delete user.deletedAt;
    await persistSharedState();
  }
  return user;
}

export async function cancelOrder(
  orderId: string,
  actor: { role: "ADMIN" | "CLIENT"; email?: string },
): Promise<Order> {
  await syncSharedStateFromDisk();
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) {
    throw new Error("Commande introuvable.");
  }
  if (actor.role === "CLIENT") {
    const user = state.users.find(
      (item) =>
        item.role === "CLIENT" &&
        !item.deletedAt &&
        item.email.toLowerCase() === String(actor.email ?? "").toLowerCase(),
    );
    if (!user || user.id !== order.userId) {
      throw new Error("Acces refuse.");
    }
  }

  if (order.status === "ANNULEE") {
    return order;
  }

  if (!isOrderTerminal(order.status)) {
    for (const line of order.lines) {
      const product = state.products.find((item) => item.id === line.productId);
      if (!product) {
        continue;
      }
      product.stock += line.quantity;
      state.stockMovements.push({
        id: id("stm"),
        productId: product.id,
        change: line.quantity,
        reason: "MANUAL_ADJUSTMENT",
        relatedOrderId: order.id,
        createdAt: nowIso(),
      });
    }
  }

  order.status = "ANNULEE";
  await persistSharedState();
  return order;
}

export async function updateOrder(
  orderId: string,
  actor: { role: "ADMIN" | "CLIENT"; email?: string },
  payload: {
    deliveryDate?: string;
    deliveryAddress?: string;
  },
): Promise<Order> {
  await syncSharedStateFromDisk();
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) {
    throw new Error("Commande introuvable.");
  }
  if (actor.role === "CLIENT") {
    const user = state.users.find(
      (item) =>
        item.role === "CLIENT" &&
        !item.deletedAt &&
        item.email.toLowerCase() === String(actor.email ?? "").toLowerCase(),
    );
    if (!user || user.id !== order.userId) {
      throw new Error("Acces refuse.");
    }
  }
  if (isOrderTerminal(order.status)) {
    throw new Error("Cette commande ne peut plus etre modifiee.");
  }

  if (typeof payload.deliveryDate === "string" && payload.deliveryDate) {
    if (!isDeliveryDateAllowed(payload.deliveryDate)) {
      throw new Error("La date de livraison ne respecte pas la regle J+1/J+2.");
    }
    order.deliveryDate = payload.deliveryDate;
  }
  if (typeof payload.deliveryAddress === "string") {
    const nextAddress = payload.deliveryAddress.trim();
    if (!nextAddress) {
      throw new Error("L'adresse de livraison est obligatoire.");
    }
    order.deliveryAddress = nextAddress;
  }

  await persistSharedState();
  return order;
}

export async function clientOverview(userId: string) {
  await syncSharedStateFromDisk();
  const orders = await listOrdersByUser(userId);
  const completedStatuses: OrderStatus[] = ["LIVREE", "CONFIRMEE", "REMBOURSEE", "ANNULEE"];

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

export async function createBackup(reason: string) {
  await syncSharedStateFromDisk();
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
  await persistSharedState();
  return { backup, snapshot };
}

export async function listBackups() {
  await syncSharedStateFromDisk();
  return state.backups;
}


