import { readFile } from "node:fs/promises";

const path = process.argv[2] || "data/shopping.json";
const text = await readFile(path, "utf8");
const value = JSON.parse(text);
if (value.schemaVersion !== 1 || !Array.isArray(value.items) || typeof value.updatedAt !== "string") throw new Error(`${path} does not match the shopping list contract.`);
for (const item of value.items) {
  if (typeof item.id !== "string" || typeof item.query !== "string" || !Array.isArray(item.recommendations)) throw new Error(`${path} contains an invalid item.`);
}
console.log(`Validated ${value.items.length} shopping item(s) in ${path}`);
