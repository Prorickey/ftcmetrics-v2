import crypto from "crypto";

const TOKEN_FIELDS = [
  "access_token",
  "refresh_token",
  "id_token",
] as const;

let derivedKey: Buffer | null = null;

function getKey(): Buffer {
  if (derivedKey) return derivedKey;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. Generate one with: openssl rand -hex 32"
    );
  }
  derivedKey = crypto.createHash("sha256").update(raw).digest();
  return derivedKey;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encrypted: string): string {
  const key = getKey();
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Invalid encrypted token format");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function isEncrypted(value: string): boolean {
  return /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/.test(value);
}

export function encryptTokenFields<T extends Record<string, unknown>>(
  data: T
): T {
  const result = { ...data };
  for (const field of TOKEN_FIELDS) {
    const value = result[field];
    if (typeof value === "string" && value.length > 0 && !isEncrypted(value)) {
      (result as Record<string, unknown>)[field] = encrypt(value);
    }
  }
  return result;
}

export function decryptTokenFields<T extends Record<string, unknown>>(
  data: T
): T {
  const result = { ...data };
  for (const field of TOKEN_FIELDS) {
    const value = result[field];
    if (typeof value === "string" && isEncrypted(value)) {
      (result as Record<string, unknown>)[field] = decrypt(value);
    }
  }
  return result;
}
