export const SHOPPING_SCHEMA = "shopping-list/v1";

export type ItemStatus = "new" | "research_ready" | "watching" | "bought" | "archived";
export type Confidence = "high" | "medium" | "low";

export interface Price {
  amount: number;
  currency: string;
  observedAt: string;
}

export interface Recommendation {
  title: string;
  merchant: string;
  url: string;
  price: Price;
  rating: number;
  reviewCount: number;
  verdict: string;
  evidence: string[];
  confidence: Confidence;
}

export interface ShoppingItem {
  id: string;
  query: string;
  notes: string;
  status: ItemStatus;
  createdAt: string;
  updatedAt: string;
  recommendations: Recommendation[];
}

export interface ShoppingList {
  schemaVersion: 1;
  updatedAt: string;
  items: ShoppingItem[];
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const timestamp = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));
const url = (value: unknown): value is string => text(value) && /^https?:\/\//i.test(value);

function validRecommendation(value: unknown): value is Recommendation {
  return record(value) && text(value.title) && text(value.merchant) && url(value.url) && record(value.price) &&
    typeof value.price.amount === "number" && Number.isFinite(value.price.amount) && text(value.price.currency) && timestamp(value.price.observedAt) &&
    typeof value.rating === "number" && value.rating >= 0 && value.rating <= 5 && typeof value.reviewCount === "number" && Number.isInteger(value.reviewCount) && value.reviewCount >= 0 &&
    text(value.verdict) && Array.isArray(value.evidence) && value.evidence.every(text) && ["high", "medium", "low"].includes(String(value.confidence));
}

function validItem(value: unknown): value is ShoppingItem {
  return record(value) && text(value.id) && /^item-[a-z0-9-]+$/.test(value.id) && text(value.query) && typeof value.notes === "string" &&
    ["new", "research_ready", "watching", "bought", "archived"].includes(String(value.status)) && timestamp(value.createdAt) && timestamp(value.updatedAt) &&
    Array.isArray(value.recommendations) && value.recommendations.every(validRecommendation);
}

export function parseShoppingList(value: unknown): ShoppingList {
  if (!record(value) || value.schemaVersion !== 1 || !timestamp(value.updatedAt) || !Array.isArray(value.items) || !value.items.every(validItem)) {
    throw new Error("The private repository returned an unsupported shopping list.");
  }
  const ids = value.items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("The shopping list contains duplicate item identifiers.");
  return value as unknown as ShoppingList;
}

export function parseShoppingListText(textValue: string): ShoppingList {
  try { return parseShoppingList(JSON.parse(textValue)); }
  catch (error) { throw error instanceof Error ? error : new Error("Shopping list JSON is invalid."); }
}

export function formatShoppingList(value: ShoppingList): string {
  return `${JSON.stringify(parseShoppingList(value), null, 2)}\n`;
}

export function createItemId(query: string, now = new Date()): string {
  const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 42) || "shopping-item";
  const random = crypto.getRandomValues(new Uint32Array(1))[0]?.toString(36).slice(0, 5) ?? "item";
  return `item-${slug}-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${random}`;
}

export function formatPrice(price: Price): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: price.currency, maximumFractionDigits: 0 }).format(price.amount);
}

export function statusLabel(status: ItemStatus): string {
  return { new: "New", research_ready: "Research ready", watching: "Watching", bought: "Bought", archived: "Archived" }[status];
}
