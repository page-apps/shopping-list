import { access, readFile } from "node:fs/promises";

await access("dist/index.html");
const html = await readFile("dist/index.html", "utf8");
if (!html.includes("shopping-fixture") || !html.includes("Scout List")) throw new Error("The built shell is missing the embedded safe fixture or title.");
if (html.includes("ghp_") || html.includes("github_pat_")) throw new Error("A credential-looking token leaked into the build.");

const manifest = JSON.parse(await readFile("dist/manifest.webmanifest", "utf8"));
if (manifest.display !== "standalone" || !Array.isArray(manifest.icons) || manifest.icons.length < 3) throw new Error("The PWA manifest is missing standalone display or required icons.");
for (const file of ["dist/service-worker.js", "dist/icons/icon-192.png", "dist/icons/icon-512.png", "dist/icons/icon-maskable-512.png", "dist/icons/apple-touch-icon.png"]) await access(file);
console.log("Validated Scout List production shell and PWA assets.");
