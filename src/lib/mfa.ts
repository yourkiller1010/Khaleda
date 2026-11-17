import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateMfaSecret() {
  return base32Encode(randomBytes(20));
}

export function base32Encode(input: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += ALPHABET[(value >>> bits) & 31];
      value &= (1 << bits) - 1;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string) {
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const character of input.replace(/=+$/, "").toUpperCase()) {
    const index = ALPHABET.indexOf(character);
    if (index === -1) throw new Error("Invalid MFA secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((value >>> bits) & 255);
      value &= (1 << bits) - 1;
    }
  }
  return Buffer.from(output);
}

function totp(secret: string, counter: number) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyMfaCode(secret: string, supplied: string, timestamp = Date.now()) {
  const code = supplied.replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(timestamp / 30000);
  for (const offset of [-1, 0, 1]) {
    const expected = totp(secret, counter + offset);
    if (timingSafeEqual(Buffer.from(code), Buffer.from(expected))) return true;
  }
  return false;
}

export function recoveryCode() {
  return `${base32Encode(randomBytes(5))}-${base32Encode(randomBytes(5))}`;
}

export function normalizeRecoveryCode(value: string) {
  return value.trim().toUpperCase().replace(/\s/g, "");
}
