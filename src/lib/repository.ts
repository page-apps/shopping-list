import { formatShoppingList, parseShoppingList, type ShoppingList } from "./domain";

export const TARGET = Object.freeze({ owner: "page-apps", name: "shopping-list-data", branch: "main", path: "data/shopping.json" });

interface GitHubFile { type: string; content?: string; encoding?: string; sha?: string; }

function decode(value: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\n/g, "")), (character) => character.charCodeAt(0)));
}

function encode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export interface RepositorySnapshot { list: ShoppingList; sha: string; account: string; }

export class PrivateShoppingRepository {
  readonly #token: string;
  constructor(token: string) { this.#token = token; }

  async #request(path: string, init?: RequestInit): Promise<Response> {
    const response = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${this.#token}`, "X-GitHub-Api-Version": "2022-11-28", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    if (response.ok) return response;
    if (response.status === 401) throw new Error("GitHub did not accept this PAT. Check that it is active and copied in full.");
    if (response.status === 403 || response.status === 404) throw new Error(`This PAT needs Contents: read and write access to ${TARGET.owner}/${TARGET.name}.`);
    if (response.status === 409) throw new Error("The private list changed while you were saving. Reload it and try again.");
    throw new Error(`GitHub returned ${response.status} while accessing the private shopping list.`);
  }

  async load(): Promise<RepositorySnapshot> {
    const [accountResponse, fileResponse] = await Promise.all([
      this.#request("/user"),
      this.#request(`/repos/${TARGET.owner}/${TARGET.name}/contents/${TARGET.path}?ref=${encodeURIComponent(TARGET.branch)}`),
    ]);
    const account = await accountResponse.json() as { login?: unknown };
    const file = await fileResponse.json() as GitHubFile;
    if (typeof account.login !== "string" || !account.login || file.type !== "file" || file.encoding !== "base64" || typeof file.content !== "string" || typeof file.sha !== "string") {
      throw new Error("The private repository did not return a readable shopping list file.");
    }
    return { list: parseShoppingList(JSON.parse(decode(file.content))), sha: file.sha, account: account.login };
  }

  async save(list: ShoppingList, sha: string): Promise<string> {
    const response = await this.#request(`/repos/${TARGET.owner}/${TARGET.name}/contents/${TARGET.path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "shopping-list: update list", content: encode(formatShoppingList(list)), sha, branch: TARGET.branch }),
    });
    const payload = await response.json() as { content?: { sha?: unknown } };
    if (typeof payload.content?.sha !== "string") throw new Error("GitHub saved the list without returning a revision.");
    return payload.content.sha;
  }
}
