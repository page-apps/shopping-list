const APP_ID = "shopping-list";
const APP_KEY = `scout-list:credentials:v1:${APP_ID}`;

interface Envelope { version: 1; token: string; createdAt: string; }

function clean(value: string): string {
  const token = value.trim();
  if (!token || /\s/.test(token)) throw new Error("Enter a GitHub personal access token without spaces.");
  return token;
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
    return null;
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
