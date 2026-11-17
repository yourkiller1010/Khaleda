import { afterEach, describe, expect, it } from "vitest";
import { actionFingerprint, actionIdempotencyKey, evaluateConditions, isPublicIp, readPath, renderTemplate, validateWebhookUrl } from "../worker.mjs";

afterEach(() => { delete process.env.AUTOMATION_WEBHOOK_ALLOWLIST; });

describe("automation conditions", () => {
  const payload = { userId: "user_123456", amount: "25.50", user: { role: "MEMBER" }, tags: ["new"] };

  it("evaluates bounded comparisons and nested equality", () => {
    expect(evaluateConditions([
      { path: "amount", operator: "gte", value: 20 },
      { path: "user.role", operator: "equals", value: "MEMBER" },
      { path: "userId", operator: "exists" },
    ], payload)).toBe(true);
  });

  it("rejects non-matches and unsupported operators", () => {
    expect(evaluateConditions([{ path: "amount", operator: "lt", value: 20 }], payload)).toBe(false);
    expect(() => evaluateConditions([{ path: "amount", operator: "eval", value: 1 }], payload)).toThrow("Unsupported condition operator");
  });

  it("reads only own, explicit properties", () => {
    expect(readPath(payload, "user.role")).toBe("MEMBER");
    expect(readPath(payload, "__proto__.polluted")).toBeUndefined();
    expect(readPath(payload, "missing")).toBeUndefined();
  });

  it("renders event values without evaluating code", () => {
    expect(renderTemplate("Deposit {{amount}} for {{user.role}}", payload)).toBe("Deposit 25.50 for MEMBER");
    expect(renderTemplate("{{missing}}", payload)).toBe("");
  });
});

describe("webhook network controls", () => {
  it("blocks private, loopback, link-local, and reserved addresses", () => {
    for (const address of ["127.0.0.1", "10.0.0.2", "172.16.0.1", "192.168.1.4", "169.254.1.1", "100.64.0.1", "192.0.2.1", "::1", "fd00::1", "fe80::1", "2001:db8::1"]) {
      expect(isPublicIp(address), address).toBe(false);
    }
  });

  it("accepts ordinary public addresses", () => {
    expect(isPublicIp("1.1.1.1")).toBe(true);
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("2606:4700:4700::1111")).toBe(true);
  });

  it("requires HTTPS and an exact configured host", () => {
    process.env.AUTOMATION_WEBHOOK_ALLOWLIST = "hooks.example.com";
    expect(validateWebhookUrl("https://hooks.example.com/events").hostname).toBe("hooks.example.com");
    expect(() => validateWebhookUrl("https://other.example.com/events")).toThrow("AUTOMATION_WEBHOOK_ALLOWLIST");
    expect(() => validateWebhookUrl("http://hooks.example.com/events")).toThrow("HTTPS");
    expect(() => validateWebhookUrl("https://hooks.example.com:8443/events")).toThrow("HTTPS");
    expect(() => validateWebhookUrl("https://user:secret@hooks.example.com/events")).toThrow("HTTPS");
  });
});

describe("automation delivery identity", () => {
  it("produces stable per-action idempotency keys", () => {
    const first = actionIdempotencyKey("execution_123456", 0);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(actionIdempotencyKey("execution_123456", 0)).toBe(first);
    expect(actionIdempotencyKey("execution_123456", 1)).not.toBe(first);
    expect(actionIdempotencyKey("execution_654321", 0)).not.toBe(first);
  });

  it("detects definition changes before replaying checkpoints", () => {
    const action = { type: "email", subject: "Receipt", text: "Confirmed" };
    expect(actionFingerprint(action)).toBe(actionFingerprint({ ...action }));
    expect(actionFingerprint({ ...action, subject: "Changed" })).not.toBe(actionFingerprint(action));
  });
});
