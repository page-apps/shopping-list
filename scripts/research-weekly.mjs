import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { runCodexResearch } from "./codex-sdk-runner.mjs";

const dataRoot = path.resolve(process.env.SHOPPING_LIST_DATA_REPO || "../shopping-list-data");
const dataPath = path.join(dataRoot, "data/shopping.json");
const model = process.env.SHOPPING_LIST_MODEL || "gpt-5.6-luna";
const timezone = process.env.SHOPPING_LIST_TIMEZONE || "Australia/Sydney";
const git = promisify(execFile);
const gitOptions = { cwd: dataRoot, maxBuffer: 1024 * 1024 };

const record = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const url = (value) => text(value) && /^https?:\/\//i.test(value);
const validRecommendation = (value) => record(value) && text(value.title) && text(value.merchant) && url(value.url) && record(value.price) &&
  typeof value.price.amount === "number" && text(value.price.currency) && text(value.price.observedAt) && typeof value.rating === "number" &&
  Number.isInteger(value.reviewCount) && value.reviewCount >= 0 && text(value.verdict) && Array.isArray(value.evidence) && value.evidence.every(text) &&
  ["high", "medium", "low"].includes(value.confidence);
const validList = (value) => record(value) && value.schemaVersion === 1 && text(value.updatedAt) && Array.isArray(value.items) && value.items.every((item) =>
  record(item) && text(item.id) && text(item.query) && typeof item.notes === "string" && ["new", "research_ready", "watching", "bought", "archived"].includes(item.status) &&
  text(item.createdAt) && text(item.updatedAt) && Array.isArray(item.recommendations) && item.recommendations.every(validRecommendation));

await git("git", ["pull", "--ff-only"], gitOptions);
await access(dataPath);
const list = JSON.parse(await readFile(dataPath, "utf8"));
if (!validList(list)) throw new Error(`Invalid shopping list contract: ${dataPath}`);
const pending = list.items.filter((item) => item.status === "new" && item.recommendations.length === 0);
if (!pending.length) {
  console.log(JSON.stringify({ itemsResearched: 0, pendingItems: 0, dataPath, model, published: false, skipped: "no_items_to_research" }, null, 2));
  process.exit(0);
}
const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["recommendations"],
  properties: {
    recommendations: { type: "array", minItems: 1, maxItems: 3, items: { type: "object", additionalProperties: false, required: ["title", "merchant", "url", "price", "rating", "reviewCount", "verdict", "evidence", "confidence"], properties: {
      title: { type: "string" }, merchant: { type: "string" }, url: { type: "string" }, price: { type: "object", additionalProperties: false, required: ["amount", "currency", "observedAt"], properties: { amount: { type: "number" }, currency: { type: "string" }, observedAt: { type: "string" } } }, rating: { type: "number" }, reviewCount: { type: "integer" }, verdict: { type: "string" }, evidence: { type: "array", items: { type: "string" } }, confidence: { type: "string", enum: ["high", "medium", "low"] }
    } } }
  }
};

for (const item of pending) {
  const prompt = `You are researching one personal shopping query. Use reliable retailer product pages and independent review sources available to you. Prefer exact products when the query is specific; otherwise choose three strong value-oriented options. Do not invent prices, ratings, review counts, availability or URLs. If a fact is uncertain, choose a lower confidence or omit the product. Return only JSON matching the supplied schema. Every recommendation must include a direct retailer product URL, an observedAt ISO timestamp, and concise evidence from reviews or specifications. Query: ${item.query}. Preferences: ${item.notes}. Research timezone: ${timezone}.`;
  const result = await runCodexResearch({ model, prompt, outputSchema, workingDirectory: dataRoot });
  if (!Array.isArray(result.recommendations) || !result.recommendations.every(validRecommendation)) throw new Error(`Codex returned invalid research for ${item.id}`);
  item.recommendations = result.recommendations;
  item.status = "research_ready";
  item.updatedAt = new Date().toISOString();
}

list.updatedAt = new Date().toISOString();
await mkdir(path.dirname(dataPath), { recursive: true });
const tempPath = `${dataPath}.tmp-${process.pid}`;
await writeFile(tempPath, `${JSON.stringify(list, null, 2)}\n`, "utf8");
await rename(tempPath, dataPath);

const changed = await git("git", ["status", "--porcelain", "--", "data/shopping.json"], gitOptions);
if (changed.stdout.trim()) {
  await git("git", ["add", "--", "data/shopping.json"], gitOptions);
  const staged = await git("git", ["diff", "--cached", "--name-only", "--", "data/shopping.json"], gitOptions);
  if (staged.stdout.trim() !== "data/shopping.json") throw new Error("The weekly research staged an unexpected private path.");
  await git("git", ["commit", "--only", "-m", `shopping-list: weekly research ${new Date().toISOString().slice(0, 10)}`, "--", "data/shopping.json"], gitOptions);
}
await git("git", ["push"], gitOptions);
console.log(JSON.stringify({ itemsResearched: pending.length, pendingItems: pending.length, dataPath, model, published: true }, null, 2));
