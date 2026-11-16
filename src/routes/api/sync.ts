import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/start-server-core";
import { type EncryptedBlob, isEncryptedBlob } from "@/lib/syncCrypto";

/*
 * Tilth's own sync endpoint (MVP). Stores the latest encrypted blob in memory,
 * keyed by the passphrase-derived sync key so every device holding the same
 * passphrase shares one replica.
 *
 * Honest limit: in-memory storage does not survive deploys or scale across
 * instances. Point Settings → Sync → Remote address at a durable endpoint
 * (any GET/PUT blob URL, e.g. WebDAV or S3-style storage) for real remote sync;
 * see httpTransport in src/lib/syncTransport.ts.
 */

const latestByKey = new Map<string, EncryptedBlob>();

// Keyed by the passphrase-derived sync key, so every device holding the same
// passphrase reads and writes the same blob.
function keyOf(request: Request): string {
  return new URL(request.url).searchParams.get("key") ?? "default";
}

async function storeBlob(request: Request): Promise<Response> {
  const req = getRequest() ?? request;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const blob = (body as { blob?: EncryptedBlob | undefined }).blob;
  if (!isEncryptedBlob(blob)) return new Response("bad blob", { status: 400 });
  latestByKey.set(keyOf(req), blob);
  return new Response(null, { status: 204 });
}

export const Route = createFileRoute("/api/sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const req = getRequest() ?? request;
        const blob = latestByKey.get(keyOf(req));
        if (!blob) return new Response(null, { status: 404 });
        return new Response(JSON.stringify(blob), {
          headers: { "content-type": "application/json" },
        });
      },
      // POST and PUT both store, so a Tilth deployment URL also works as a
      // generic httpTransport endpoint (which uses PUT).
      POST: async ({ request }) => storeBlob(request),
      PUT: async ({ request }) => storeBlob(request),
    },
  },
});
