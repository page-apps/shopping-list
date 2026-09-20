import { CredentialVault } from "./credentials";
import { createItemId, formatPrice, parseShoppingList, statusLabel, type ItemStatus, type ShoppingItem, type ShoppingList } from "./domain";
import { PrivateShoppingRepository, type RepositorySnapshot } from "./repository";

const vault = new CredentialVault();
const $ = <T extends Element>(selector: string): T => {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing UI element: ${selector}`);
  return node;
};
const embedded = <T>(id: string): T => JSON.parse($<HTMLScriptElement>(`#${id}`).textContent || "null") as T;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
const formatShortDate = (value: string) => new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(value));

let list: ShoppingList = structuredClone(embedded<ShoppingList>("shopping-fixture"));
let repository: PrivateShoppingRepository | null = null;
let revision = "";
let account = "";
let filter: "all" | ItemStatus = "all";
let selectedId = list.items[0]?.id ?? null;
let installPrompt: (Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }) | null = null;

function setStatus(label: string, detail: string, tone: "idle" | "working" | "ready" | "error" = "idle"): void {
  $<HTMLElement>("[data-status]").dataset.tone = tone;
  $<HTMLElement>("[data-status-label]").textContent = label;
  $<HTMLElement>("[data-status-detail]").textContent = detail;
}

function showConnected(connected: boolean): void {
  document.querySelectorAll<HTMLElement>("[data-owner-only]").forEach((node) => node.toggleAttribute("hidden", !connected));
  $<HTMLElement>("[data-private-gate]").toggleAttribute("hidden", connected);
  $<HTMLElement>("[data-connect-button]").toggleAttribute("hidden", connected);
  $<HTMLElement>("[data-disconnect-button]").toggleAttribute("hidden", !connected);
}

function renderStats(): void {
  const active = list.items.filter((item) => item.status !== "archived");
  const researched = active.filter((item) => item.recommendations.length > 0).length;
  $<HTMLElement>("[data-stat-items]").textContent = String(active.length);
  $<HTMLElement>("[data-stat-researched]").textContent = String(researched);
  $<HTMLElement>("[data-stat-updated]").textContent = active.length ? formatShortDate(list.updatedAt) : "—";
  $<HTMLElement>("[data-list-count]").textContent = `${active.length} ${active.length === 1 ? "thing" : "things"}`;
}

function recommendationCard(item: ShoppingItem): string {
  const pick = item.recommendations[0];
  if (!pick) return `<div class="empty-research"><span class="empty-research-mark">✦</span><div><strong>Waiting for Codex</strong><p>The next scheduled coding-agent pass will find options, prices and review signals.</p></div></div>`;
  return `<div class="pick-card">
    <div class="pick-top"><span class="pick-badge">Best value</span><span class="confidence">${escapeHtml(pick.confidence)} confidence</span></div>
    <div class="pick-heading"><div><p class="pick-kicker">${escapeHtml(pick.merchant)}</p><h4>${escapeHtml(pick.title)}</h4></div><strong class="price">${escapeHtml(formatPrice(pick.price))}</strong></div>
    <p class="verdict">${escapeHtml(pick.verdict)}</p>
    <div class="review-row"><span class="stars" aria-label="${pick.rating} out of 5 stars">${"★".repeat(Math.round(pick.rating))}${"☆".repeat(5 - Math.round(pick.rating))}</span><strong>${pick.rating.toFixed(1)}</strong><span>${pick.reviewCount.toLocaleString()} reviews</span><span>·</span><span>checked ${escapeHtml(formatShortDate(pick.price.observedAt))}</span></div>
    <ul class="evidence">${pick.evidence.slice(0, 2).map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>
    <a class="source-link" href="${escapeHtml(pick.url)}" target="_blank" rel="noreferrer">View at ${escapeHtml(pick.merchant)} <span aria-hidden="true">↗</span></a>
  </div>`;
}

function itemCard(item: ShoppingItem): string {
  const active = item.id === selectedId;
  const statusClass = item.status.replace("_", "-");
  return `<article class="item-card ${active ? "is-selected" : ""}" data-item-card data-item-id="${escapeHtml(item.id)}">
    <button class="item-main" type="button" data-select-item="${escapeHtml(item.id)}">
      <span class="item-check ${item.status === "bought" ? "checked" : ""}" aria-hidden="true">${item.status === "bought" ? "✓" : ""}</span>
      <span class="item-copy"><strong>${escapeHtml(item.query)}</strong><span>${escapeHtml(item.notes || "No extra notes")}</span></span>
      <span class="item-status ${statusClass}">${escapeHtml(statusLabel(item.status))}</span>
      <span class="item-arrow" aria-hidden="true">${active ? "⌄" : "›"}</span>
    </button>
    ${active ? `<div class="item-detail"><div class="detail-label"><span>Scout’s pick</span><span>${item.recommendations.length ? `${item.recommendations.length} options found` : "Not researched yet"}</span></div>${recommendationCard(item)}${item.recommendations.length > 1 ? `<div class="alternatives"><span>Also worth a look</span>${item.recommendations.slice(1, 3).map((alternative) => `<a href="${escapeHtml(alternative.url)}" target="_blank" rel="noreferrer"><span>${escapeHtml(alternative.title)}</span><strong>${escapeHtml(formatPrice(alternative.price))}</strong></a>`).join("")}</div>` : ""}<div class="item-actions"><button type="button" data-cycle-status="${escapeHtml(item.id)}">Mark ${item.status === "bought" ? "watching" : "bought"}</button><button type="button" class="quiet" data-archive-item="${escapeHtml(item.id)}">Archive</button></div></div>` : ""}
  </article>`;
}

function render(): void {
  const visible = list.items.filter((item) => item.status !== "archived" && (filter === "all" || item.status === filter));
  $<HTMLElement>("[data-item-list]").innerHTML = visible.length ? visible.map(itemCard).join("") : `<div class="no-items"><span>◌</span><h3>Nothing here yet</h3><p>Add a thing you’re looking for and Scout will take it from there.</p></div>`;
  document.querySelectorAll<HTMLElement>("[data-filter]").forEach((button) => button.classList.toggle("is-active", button.getAttribute("data-filter") === filter));
  renderStats();
  document.querySelectorAll<HTMLElement>("[data-select-item]").forEach((button) => button.addEventListener("click", () => { selectedId = button.dataset.selectItem ?? null; render(); }));
  document.querySelectorAll<HTMLElement>("[data-cycle-status]").forEach((button) => button.addEventListener("click", () => void updateItem(button.dataset.cycleStatus!, { status: "bought" })));
  document.querySelectorAll<HTMLElement>("[data-archive-item]").forEach((button) => button.addEventListener("click", () => void updateItem(button.dataset.archiveItem!, { status: "archived" })));
}

async function persist(next: ShoppingList): Promise<void> {
  if (!repository) { list = next; render(); return; }
  setStatus("Saving list", "Committing the private list to GitHub", "working");
  revision = await repository.save(next, revision);
  list = next;
  setStatus(`Connected as ${account}`, `Private list · updated ${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(next.updatedAt))}`, "ready");
  render();
}

async function updateItem(id: string, patch: Partial<ShoppingItem>): Promise<void> {
  const now = new Date().toISOString();
  const next = parseShoppingList({ ...list, updatedAt: now, items: list.items.map((item) => item.id === id ? { ...item, ...patch, updatedAt: now } : item) });
  await persist(next);
}

async function addItem(query: string, notes: string): Promise<void> {
  const now = new Date().toISOString();
  const item: ShoppingItem = { id: createItemId(query, new Date()), query: query.trim(), notes: notes.trim(), status: "new", createdAt: now, updatedAt: now, recommendations: [] };
  selectedId = item.id;
  await persist(parseShoppingList({ ...list, updatedAt: now, items: [item, ...list.items] }));
  $<HTMLFormElement>("[data-add-form]").reset();
}

async function connect(token: string, persistence: "memory" | "session" | "local", remember = true): Promise<void> {
  setStatus("Connecting", "Checking the fixed private repository", "working");
  const nextRepository = new PrivateShoppingRepository(remember ? vault.connect(token, persistence) : token);
  const snapshot: RepositorySnapshot = await nextRepository.load();
  repository = nextRepository;
  revision = snapshot.sha;
  account = snapshot.account;
  list = snapshot.list;
  selectedId = list.items[0]?.id ?? null;
  showConnected(true);
  setStatus(`Connected as ${account}`, `Private list · updated ${formatShortDate(list.updatedAt)}`, "ready");
  render();
  $<HTMLDialogElement>("[data-connect-dialog]").close();
}

function openConnect(): void {
  $<HTMLElement>("[data-shared-option]").toggleAttribute("hidden", !vault.hasShared());
  $<HTMLElement>("[data-connect-error]").textContent = "";
  $<HTMLDialogElement>("[data-connect-dialog]").showModal();
}

function setup(): void {
  $<HTMLFormElement>("[data-add-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const query = String(form.get("query") ?? "").trim();
    if (!query) return;
    void addItem(query, String(form.get("notes") ?? "")).catch((error) => setStatus("Could not save", error instanceof Error ? error.message : "The list could not be saved.", "error"));
  });
  document.querySelectorAll<HTMLElement>("[data-filter]").forEach((button) => button.addEventListener("click", () => { filter = button.dataset.filter as typeof filter; render(); }));
  document.querySelectorAll<HTMLElement>("[data-connect-button]").forEach((button) => button.addEventListener("click", openConnect));
  $<HTMLElement>("[data-private-gate]").addEventListener("click", openConnect);
  $<HTMLElement>("[data-disconnect-button]").addEventListener("click", () => { vault.disconnect(); repository = null; account = ""; list = structuredClone(embedded<ShoppingList>("shopping-fixture")); selectedId = list.items[0]?.id ?? null; showConnected(false); setStatus("Reader mode", "A safe in-memory example is loaded", "idle"); render(); });
  $<HTMLElement>("[data-dialog-close]").addEventListener("click", () => $<HTMLDialogElement>("[data-connect-dialog]").close());
  $<HTMLElement>("[data-use-shared]").addEventListener("click", () => {
    void connect(vault.useShared(), "memory", false).catch((error) => {
      $<HTMLElement>("[data-connect-error]").textContent = error instanceof Error ? error.message : "Could not use the shared PAT.";
      setStatus("Connection failed", "Check the shared PAT and private repository access", "error");
    });
  });
  $<HTMLFormElement>("[data-token-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    void connect(String(form.get("token") ?? ""), String(form.get("persistence") ?? "memory") as "memory" | "session" | "local").catch((error) => { $<HTMLElement>("[data-connect-error]").textContent = error instanceof Error ? error.message : "Could not connect."; setStatus("Connection failed", "Check the token and private repository access", "error"); });
  });
  $<HTMLElement>("[data-theme-toggle]").addEventListener("click", () => document.documentElement.classList.toggle("dark"));
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPrompt = event as typeof installPrompt; $<HTMLElement>("[data-install]").removeAttribute("hidden"); });
  $<HTMLElement>("[data-install]").addEventListener("click", async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    installPrompt = null;
    $<HTMLElement>("[data-install]").setAttribute("hidden", "");
  });
  window.addEventListener("appinstalled", () => { installPrompt = null; $<HTMLElement>("[data-install]").setAttribute("hidden", ""); });
  if ("serviceWorker" in navigator) window.addEventListener("load", () => void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`, { scope: import.meta.env.BASE_URL }));
  const token = vault.restore();
  if (token) void connect(token, "memory", false).catch(() => vault.disconnect());
  render();
}

setup();
