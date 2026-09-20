import { defineConfig } from "astro/config";

const [owner = "page-apps", repository = "shopping-list"] = (
  process.env.GITHUB_REPOSITORY ?? "page-apps/shopping-list"
).split("/");
const isOwnerSite = repository === `${owner}.github.io`;

export default defineConfig({
  site: `https://${owner}.github.io`,
  base: process.env.GITHUB_ACTIONS === "true" && !isOwnerSite ? `/${repository}` : "/",
  output: "static",
  build: { format: "directory" },
});
