import { describe, expect, it } from "vitest";
import { base32Encode, generateMfaSecret, normalizeRecoveryCode, recoveryCode, verifyMfaCode } from "../src/lib/mfa";

describe("TOTP multi-factor authentication", () => {
  const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // ASCII: 12345678901234567890

  it("matches the RFC 6238 SHA-1 test vector at 59 seconds", () => {
    expect(verifyMfaCode(rfcSecret, "287082", 59_000)).toBe(true);
  });

  it("accepts the adjacent time step but rejects malformed or incorrect codes", () => {
    expect(verifyMfaCode(rfcSecret, "287082", 60_000)).toBe(true);
    expect(verifyMfaCode(rfcSecret, "287082", 120_000)).toBe(false);
    expect(verifyMfaCode(rfcSecret, "28708", 59_000)).toBe(false);
    expect(verifyMfaCode(rfcSecret, "000000", 59_000)).toBe(false);
  });

  it("generates high-entropy base32 secrets and normalized recovery codes", () => {
    expect(generateMfaSecret()).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(Buffer.from("Hello"))).toBe("JBSWY3DP");
    const code = recoveryCode();
    expect(code).toMatch(/^[A-Z2-7]{8}-[A-Z2-7]{8}$/);
    expect(normalizeRecoveryCode(` ${code.toLowerCase()} `)).toBe(code);
  });
});
