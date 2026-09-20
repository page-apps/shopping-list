import { access, readFile } from "node:fs/promises";

await access("dist/index.html");
const html = await readFile("dist/index.html", "utf8");
if (!html.includes("shopping-fixture") || !html.includes("Scout List")) throw new Error("The built shell is missing the embedded safe fixture or title.");
if (html.includes("ghp_") || html.includes("github_pat_")) throw new Error("A credential-looking token leaked into the build.");
console.log("Validated Scout List production shell.");
