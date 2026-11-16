import { describe, expect, it } from "vitest";
import { decryptPayload, encryptPayload, isEncryptedBlob, syncKey } from "./syncCrypto";

const PASSPHRASE = "correct horse battery staple";
const OTHER = "another correct passphrase";

describe("syncCrypto", () => {
  it("syncKey is stable per passphrase and never the passphrase itself", async () => {
    const a = await syncKey(PASSPHRASE);
    expect(a).toBe(await syncKey(PASSPHRASE));
    expect(a).not.toBe(await syncKey(OTHER));
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).not.toContain(PASSPHRASE);
  });
  it(
    "round trips a payload",
    async () => {
      const plaintext = JSON.stringify({ v: 1, collections: { tasks: [] } });
      const blob = await encryptPayload(PASSPHRASE, plaintext);
      expect(isEncryptedBlob(blob)).toBe(true);
      expect(await decryptPayload(PASSPHRASE, blob)).toBe(plaintext);
    },
    30_000,
  );

  it(
    "throws on a wrong passphrase",
    async () => {
      const blob = await encryptPayload(PASSPHRASE, "hello");
      await expect(decryptPayload(OTHER, blob)).rejects.toThrow("wrong passphrase");
    },
    30_000,
  );

  it(
    "never repeats itself: two encryptions differ",
    async () => {
      const a = await encryptPayload(PASSPHRASE, "same");
      const b = await encryptPayload(PASSPHRASE, "same");
      expect(a.kdf.salt).not.toBe(b.kdf.salt);
      expect(a.iv).not.toBe(b.iv);
      expect(a.ct).not.toBe(b.ct);
    },
    30_000,
  );

  it("rejects junk with isEncryptedBlob", () => {
    expect(isEncryptedBlob(null)).toBe(false);
    expect(isEncryptedBlob("blob")).toBe(false);
    expect(isEncryptedBlob({})).toBe(false);
    expect(isEncryptedBlob({ v: 2, alg: "AES-GCM", kdf: {}, iv: "a", ct: "b" })).toBe(false);
    expect(
      isEncryptedBlob({
        v: 1,
        alg: "AES-GCM",
        kdf: { name: "PBKDF2-SHA256", iterations: 1, salt: "s" },
        iv: "i",
      }),
    ).toBe(false);
  });
});
