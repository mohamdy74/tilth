import { isEncryptedBlob, type EncryptedBlob } from "./syncCrypto";

/*
 * Pluggable remote transports for the sync engine. The engine never talks to
 * the network itself â€” it only sees this interface, so tests use fakeTransport.
 */

export interface SyncTransport {
  readonly id: string;
  /** null = nothing stored remotely yet. */
  pull(): Promise<EncryptedBlob | null>;
  push(blob: EncryptedBlob): Promise<void>;
}

export class SyncError extends Error {
  code: "network" | "auth" | "server" | "shape";
  constructor(code: SyncError["code"], message: string) {
    super(message);
    this.name = "SyncError";
    this.code = code;
  }
}

function codeFor(status: number): "auth" | "server" {
  return status === 401 || status === 403 ? "auth" : "server";
}

function parseBlob(text: string): EncryptedBlob | null {
  if (!text) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new SyncError("shape", "Remote did not return JSON");
  }
  // Tilth's own route wraps the blob in { blob }; a raw blob is also accepted.
  const raw = (json as { blob?: unknown }).blob ?? json;
  if (!isEncryptedBlob(raw)) throw new SyncError("shape", "Remote blob is malformed");
  return raw;
}

/** Generic HTTP endpoint: GET returns the blob, PUT stores it. Works with WebDAV/S3-style APIs too. */
export function httpTransport(opts: {
  url: string;
  token?: string | undefined;
  headers?: Record<string, string> | undefined;
}): SyncTransport {
  const headers = (): Record<string, string> => ({
    ...(opts.headers ?? {}),
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
  });
  return {
    id: "http",
    async pull() {
      let res: Response;
      try {
        res = await fetch(opts.url, { headers: headers() });
      } catch {
        throw new SyncError("network", "Could not reach the remote");
      }
      if (res.status === 404) return null;
      if (!res.ok) throw new SyncError(codeFor(res.status), `Remote answered ${res.status}`);
      return parseBlob(await res.text());
    },
    async push(blob: EncryptedBlob) {
      let res: Response;
      try {
        res = await fetch(opts.url, {
          method: "PUT",
          headers: { ...headers(), "content-type": "application/json" },
          body: JSON.stringify(blob),
        });
      } catch {
        throw new SyncError("network", "Could not reach the remote");
      }
      if (!res.ok) throw new SyncError(codeFor(res.status), `Remote answered ${res.status}`);
    },
  };
}

/** Tilth's own sync route on the app's server: POST stores, GET reads. */
export function tilthTransport(opts: {
  token?: string | undefined;
  /** Blob scope derived from the passphrase (see syncKey). */
  key: string;
}): SyncTransport {
  const url = `/api/sync?key=${encodeURIComponent(opts.key)}`;
  const headers = (): Record<string, string> => ({
    "content-type": "application/json",
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
  });
  return {
    id: "tilth",
    async pull() {
      let res: Response;
      try {
        res = await fetch(url, { headers: headers() });
      } catch {
        throw new SyncError("network", "Could not reach the sync server");
      }
      if (res.status === 404) return null;
      if (!res.ok) throw new SyncError(codeFor(res.status), `Sync server answered ${res.status}`);
      return parseBlob(await res.text());
    },
    async push(blob: EncryptedBlob) {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ blob }),
        });
      } catch {
        throw new SyncError("network", "Could not reach the sync server");
      }
      if (!res.ok) throw new SyncError(codeFor(res.status), `Sync server answered ${res.status}`);
    },
  };
}

/** In-memory transport for tests and offline preview. */
export function fakeTransport(store: { blob: EncryptedBlob | null }): SyncTransport {
  return {
    id: "fake",
    async pull() {
      return store.blob;
    },
    async push(blob) {
      store.blob = blob;
    },
  };
}
