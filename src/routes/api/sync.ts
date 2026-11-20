import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/start-server-core";
import { type EncryptedBlob, isEncryptedBlob } from "@/lib/syncCrypto";

/*
 * Tilth's own sync endpoint (MVP). The passphrase-derived key is a capability:
 * callers must present it before reading or replacing the encrypted replica.
 * ETag preconditions prevent a stale writer from overwriting a newer replica.
 *
 * Honest limit: in-memory storage does not survive deploys or scale across
 * instances. Point Settings → Sync → Remote address at a durable endpoint for
 * production sync; see httpTransport in src/lib/syncTransport.ts.
 */

const latestByKey = new Map<string, EncryptedBlob>();

function keyOf(request: Request): string | null {
  const key = new URL(request.url).searchParams.get("key");
  return key !== null && /^[0-9a-f]{16}$/.test(key) ? key : null;
}

async function etagOf(blob: EncryptedBlob): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(blob)),
  );
  return (
    '"' + Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("") + '"'
  );
}

async function storeBlob(request: Request): Promise<Response> {
  const req = getRequest() ?? request;
  const key = keyOf(req);
  if (!key) return new Response("valid sync key required", { status: 400 });
  const current = latestByKey.get(key);
  if (current) {
    const expected = req.headers.get("if-match");
    if (!expected) return new Response("if-match required", { status: 428 });
    if (expected !== (await etagOf(current))) {
      return new Response("replica changed; pull before pushing", { status: 412 });
    }
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const blob = (body as { blob?: EncryptedBlob | undefined }).blob;
  if (!isEncryptedBlob(blob)) return new Response("bad blob", { status: 400 });
  latestByKey.set(key, blob);
  return new Response(null, { status: 204, headers: { etag: await etagOf(blob) } });
}

export const Route = createFileRoute("/api/sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const req = getRequest() ?? request;
        const key = keyOf(req);
        if (!key) return new Response("valid sync key required", { status: 400 });
        const blob = latestByKey.get(key);
        if (!blob) return new Response(null, { status: 404 });
        const etag = await etagOf(blob);
        if (req.headers.get("if-none-match") === etag) {
          return new Response(null, { status: 304, headers: { etag } });
        }
        return new Response(JSON.stringify(blob), {
          headers: { "content-type": "application/json", etag },
        });
      },
      // POST and PUT both store, so a Tilth deployment URL also works as a
      // generic httpTransport endpoint (which uses PUT).
      POST: async ({ request }) => storeBlob(request),
      PUT: async ({ request }) => storeBlob(request),
    },
  },
});
