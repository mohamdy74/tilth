import { afterEach, describe, expect, it, vi } from "vitest";
import type { EncryptedBlob } from "./syncCrypto";
import { httpTransport, tilthTransport } from "./syncTransport";

const blob: EncryptedBlob = {
  v: 1,
  alg: "AES-GCM",
  kdf: { name: "PBKDF2-SHA256", iterations: 310_000, salt: "c2FsdA==" },
  iv: "aXY=",
  ct: "Y3Q=",
};

function fetchWithEtag() {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(JSON.stringify(blob), { status: 200, headers: { etag: '"v1"' } }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
}

afterEach(() => vi.unstubAllGlobals());

describe("sync ETag forwarding", () => {
  it("sends the pulled ETag with a Tilth push", async () => {
    const fetchMock = fetchWithEtag();
    vi.stubGlobal("fetch", fetchMock);
    const transport = tilthTransport({ key: "0123456789abcdef" });

    expect(await transport.pull()).toEqual(blob);
    await transport.push(blob);

    const init = fetchMock.mock.calls[1]?.[1];
    expect(init?.headers).toMatchObject({ "if-match": '"v1"' });
  });

  it("sends the pulled ETag with a generic HTTP push", async () => {
    const fetchMock = fetchWithEtag();
    vi.stubGlobal("fetch", fetchMock);
    const transport = httpTransport({ url: "https://example.test/blob" });

    expect(await transport.pull()).toEqual(blob);
    await transport.push(blob);

    const init = fetchMock.mock.calls[1]?.[1];
    expect(init?.headers).toMatchObject({ "if-match": '"v1"' });
  });
});
