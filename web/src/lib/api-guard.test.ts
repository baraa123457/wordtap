import { describe, expect, it } from "vitest";
import { isAllowedOrigin, guardApiRequest } from "./api-guard";

describe("api-guard security", () => {
  it("allows same-origin or server requests without Origin header", () => {
    const req = new Request("http://localhost:3000/api/translate");
    expect(isAllowedOrigin(req)).toBe(true);
  });

  it("allows browser extension origins", () => {
    const chromeReq = new Request("https://wordtap.app/api/translate", {
      headers: { origin: "chrome-extension://abcdefghijklmnop" },
    });
    expect(isAllowedOrigin(chromeReq)).toBe(true);

    const firefoxReq = new Request("https://wordtap.app/api/translate", {
      headers: { origin: "moz-extension://abcdef-1234-5678" },
    });
    expect(isAllowedOrigin(firefoxReq)).toBe(true);
  });

  it("allows localhost and 127.0.0.1 for local development", () => {
    const localReq = new Request("http://localhost:3000/api/translate", {
      headers: { origin: "http://localhost:3000" },
    });
    expect(isAllowedOrigin(localReq)).toBe(true);

    const ipReq = new Request("http://127.0.0.1:3000/api/translate", {
      headers: { origin: "http://127.0.0.1:3000" },
    });
    expect(isAllowedOrigin(ipReq)).toBe(true);
  });

  it("blocks unauthorized cross-origin requests", () => {
    const evilReq = new Request("https://wordtap.app/api/translate", {
      headers: { origin: "https://evil-attacker.com" },
    });
    expect(isAllowedOrigin(evilReq)).toBe(false);
  });

  it("blocks cross-origin request even if attacker supplies dummy Bearer token", () => {
    const evilReq = new Request("https://wordtap.app/api/translate", {
      headers: {
        origin: "https://evil-attacker.com",
        authorization: "Bearer 12345678901234567890",
      },
    });
    expect(isAllowedOrigin(evilReq)).toBe(false);
  });

  it("enforces rate limits per client IP", () => {
    const testRoute = "test-rate-limit";
    const req = new Request("http://localhost:3000/api/test", {
      headers: { "x-forwarded-for": "203.0.113.195" },
    });

    // Send 3 requests with limit of 3
    expect(guardApiRequest(req, testRoute, 3)).toBeNull();
    expect(guardApiRequest(req, testRoute, 3)).toBeNull();
    expect(guardApiRequest(req, testRoute, 3)).toBeNull();

    // 4th request must be blocked with HTTP 429
    const blocked = guardApiRequest(req, testRoute, 3);
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
  });
});
