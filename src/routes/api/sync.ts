import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/start-server-core";
import { type EncryptedBlob, isEncryptedBlob } from "@/lib/syncCrypto";

/*
 * Tilth's own sync endpoint (MVP). Stores the latest encrypted blob in
 * memory, keyed implicitly by the single deployment instance.
 *
 * Honest limit: in-memory storage does not survive deploys or scale across
 * instances. Production remote sync requires a durable binding (Cloudflare KV
 * or D1) wired here — see src/lib/syncTransport.ts for the pluggable
 * httpTransport that works with any endpoint once one exists.
 */

let latestByDevice = new Map<string, EncryptedBlob>();

function blobFor(request: Request): EncryptedBlob | null {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId") ?? "default";
  return latestByDevice.get(deviceId) ?? null;
}

export const Route = createFileRoute("/api/sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const req = getRequest() ?? request;
        const blob = blobFor(req);
        if (!blob) return new Response(null, { status: 404 });
        return new Response(JSON.stringify(blob), {
          headers: { "content-type": "application/json" },
        });
      },
      POST: async ({ request }) => {
        const req = getRequest() ?? request;
        const url = new URL(req.url);
        const deviceId = url.searchParams.get("deviceId") ?? "default";
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        const blob = (body as { blob?: EncryptedBlob | undefined }).blob;
        if (!isEncryptedBlob(blob)) return new Response("bad blob", { status: 400 });
        latestByDevice.set(deviceId, blob);
        return new Response(null, { status: 204 });
      },
    },
  },
});
