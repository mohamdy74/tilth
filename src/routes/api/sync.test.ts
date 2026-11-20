import { describe, expect, it, vi } from "vitest";
import type { EncryptedBlob } from "@/lib/syncCrypto";
import { Route } from "./sync";

vi.mock("@tanstack/start-server-core", () => ({ getRequest: () => undefined }));

const KEY = "0123456789abcdef";
const URL = "https://tilth.test/api/sync?key=" + KEY;
const blob: EncryptedBlob = {
  v: 1,
  alg: "AES-GCM",
  kdf: { name: "PBKDF2-SHA256", iterations: 310_000, salt: "c2FsdA==" },
  iv: "aXY=",
  ct: "Y3Q=",
};

const handlers = Route.options.server?.handlers as unknown as {
  GET: (context: { request: Request }) => Promise<Response>;
  PUT: (context: { request: Request }) => Promise<Response>;
};

function request(method: "GET" | "PUT", body?: unknown, headers?: Record<string, string>) {
  return new Request(URL, {
    method,
    headers: body === undefined ? (headers ?? {}) : { "content-type": "application/json", ...headers },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

describe("sync API key and ETag preconditions", () => {
  it("rejects invalid keys and stale writes, then allows revalidation", async () => {
    expect((await handlers.GET({ request: request("GET") })).status).toBe(404);

    const invalid = new Request("https://tilth.test/api/sync?key=default");
    expect((await handlers.GET({ request: invalid })).status).toBe(400);

    const created = await handlers.PUT({ request: request("PUT", { blob }) });
    expect(created.status).toBe(204);
    const etag = created.headers.get("etag");
    expect(etag).toBeTruthy();

    const fetched = await handlers.GET({ request: request("GET") });
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get("etag")).toBe(etag);
    expect(await fetched.json()).toEqual(blob);

    expect((await handlers.PUT({ request: request("PUT", { blob }) })).status).toBe(428);
    expect(
      (await handlers.PUT({ request: request("PUT", { blob }, { "if-match": '"stale"' }) }))
        .status,
    ).toBe(412);

    const updated = await handlers.PUT({
      request: request("PUT", { blob }, { "if-match": etag! }),
    });
    expect(updated.status).toBe(204);
    const nextEtag = updated.headers.get("etag");
    expect(nextEtag).toBe(etag);

    const revalidated = await handlers.GET({
      request: request("GET", undefined, { "if-none-match": nextEtag! }),
    });
    expect(revalidated.status).toBe(304);
  });
});
