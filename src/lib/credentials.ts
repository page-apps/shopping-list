const APP_ID = "shopping-list";
const APP_KEY = `scout-list:credentials:v1:${APP_ID}`;
const SHARED_KEY = "repo-apps:credentials:v1";
const REPOSITORY_HINT = "page-apps/shopping-list-data";

interface Envelope { version: 1; token: string; createdAt: string; }
interface SharedEnvelope {
  version: 1;
  scope: "shared";
  credential: { kind: "pat"; token: string; createdAt: string; account?: string };
  apps: Record<string, { connectedAt: string; repositoryHint?: string }>;
}

function clean(value: string): string {
  const token = value.trim();
  if (!token || /\s/.test(token)) throw new Error("Enter a GitHub personal access token without spaces.");
  return token;
}

function readShared(): SharedEnvelope | null {
  try {
    const value = JSON.parse(localStorage.getItem(SHARED_KEY) ?? "null") as Partial<SharedEnvelope>;
    if (value.version !== 1 || value.scope !== "shared" || value.credential?.kind !== "pat" ||
      typeof value.credential.token !== "string" || !value.credential.token || typeof value.credential.createdAt !== "string" ||
      typeof value.apps !== "object" || value.apps === null) return null;
    return value as SharedEnvelope;
  } catch {
    return null;
  }
}

export class CredentialVault {
  #memoryToken: string | null = null;

  restore(): string | null {
    if (this.#memoryToken) return this.#memoryToken;
    for (const storage of [sessionStorage, localStorage]) {
      try {
        const raw = storage.getItem(APP_KEY);
        if (!raw) continue;
        const value = JSON.parse(raw) as Partial<Envelope>;
        if (value.version === 1 && typeof value.token === "string" && value.token) return value.token;
      } catch { /* stale browser storage is ignored */ }
    }
    const shared = readShared();
    return shared?.apps[APP_ID] ? shared.credential.token : null;
  }

  hasShared(): boolean { return readShared() !== null; }

  sharedToken(): string {
    const shared = readShared();
    if (!shared) throw new Error("No shared Page Apps PAT is available in this browser.");
    return shared.credential.token;
  }

  useShared(): string {
    const shared = readShared();
    if (!shared) throw new Error("No shared Page Apps PAT is available in this browser.");
    shared.apps[APP_ID] = { connectedAt: new Date().toISOString(), repositoryHint: REPOSITORY_HINT };
    localStorage.setItem(SHARED_KEY, JSON.stringify(shared));
    return shared.credential.token;
  }

  connect(value: string, persistence: "memory" | "session" | "local"): string {
    const token = clean(value);
    this.disconnect();
    if (persistence === "memory") this.#memoryToken = token;
    else (persistence === "session" ? sessionStorage : localStorage).setItem(APP_KEY, JSON.stringify({ version: 1, token, createdAt: new Date().toISOString() } satisfies Envelope));
    return token;
  }

  disconnect(): void {
    this.#memoryToken = null;
    sessionStorage.removeItem(APP_KEY);
    localStorage.removeItem(APP_KEY);
  }
}
