/*
 * Client-side encryption for remote sync, WebCrypto only.
 *
 * Honest limit: WebCrypto offers PBKDF2 but NOT Argon2id, so the KDF is
 * PBKDF2-HMAC-SHA256 at a high iteration count and the AEAD is AES-GCM-256.
 * The server only ever sees opaque ciphertext â€” the passphrase never leaves
 * the device (it lives in `settings`, which is never synced).
 */

export interface EncryptedBlob {
  v: 1;
  alg: "AES-GCM";
  kdf: { name: "PBKDF2-SHA256"; iterations: number; salt: string };
  iv: string;
  ct: string;
}

const ITERATIONS = 310_000;

function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const base = await subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: ITERATIONS },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptPayload(
  passphrase: string,
  plaintext: string,
): Promise<EncryptedBlob> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext),
  );
  return {
    v: 1,
    alg: "AES-GCM",
    kdf: { name: "PBKDF2-SHA256", iterations: ITERATIONS, salt: toB64(salt) },
    iv: toB64(iv),
    ct: toB64(new Uint8Array(ct)),
  };
}

export async function decryptPayload(passphrase: string, blob: EncryptedBlob): Promise<string> {
  if (!isEncryptedBlob(blob)) throw new Error("Not an encrypted sync blob");
  const key = await deriveKey(passphrase, fromB64(blob.kdf.salt));
  try {
    const pt = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(blob.iv) as BufferSource },
      key,
      fromB64(blob.ct) as BufferSource,
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error("wrong passphrase");
  }
}

export function isEncryptedBlob(v: unknown): v is EncryptedBlob {
  if (!v || typeof v !== "object") return false;
  const b = v as Record<string, unknown>;
  return (
    b["v"] === 1 &&
    b["alg"] === "AES-GCM" &&
    typeof b["iv"] === "string" &&
    typeof b["ct"] === "string" &&
    !!b["kdf"] &&
    typeof b["kdf"] === "object" &&
    (b["kdf"] as Record<string, unknown>)["name"] === "PBKDF2-SHA256" &&
    typeof (b["kdf"] as Record<string, unknown>)["iterations"] === "number" &&
    typeof (b["kdf"] as Record<string, unknown>)["salt"] === "string"
  );
}
