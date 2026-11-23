import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowedOrigin, guardApiRequest, guardApiRequestShared } from "./api-guard";

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

  it("blocks prefix-matching CORS bypass attacks (e.g. localhost.attacker.com)", () => {
    const localhostBypassReq = new Request("https://wordtap.app/api/translate", {
      headers: { origin: "http://localhost.attacker.com" },
    });
    expect(isAllowedOrigin(localhostBypassReq)).toBe(false);

    const ipBypassReq = new Request("https://wordtap.app/api/translate", {
      headers: { origin: "http://127.0.0.1.evil.org" },
    });
    expect(isAllowedOrigin(ipBypassReq)).toBe(false);
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

describe("shared rate limiter (Redis)", () => {
  const OLD = { ...process.env };
  afterEach(() => {
    process.env = { ...OLD };
    vi.unstubAllGlobals();
  });
  const mkReq = (ip: string) => new Request("http://localhost:3000/api/translate", { headers: { "x-forwarded-for": ip } });

  it("behaves like the local limiter when Redis is not configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.KV_REST_API_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await guardApiRequestShared(mkReq("9.9.9.1"), "shared-none", 5)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks with 429 once the SHARED counter exceeds the limit (even if this instance saw few requests)", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ result: 61 }, { result: 1 }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await guardApiRequestShared(mkReq("9.9.9.2"), "shared-block", 60);
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toBe("https://redis.example.io/pipeline");
  });

  it("allows requests under the shared limit", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([{ result: 3 }, { result: 1 }]), { status: 200 })));
    expect(await guardApiRequestShared(mkReq("9.9.9.3"), "shared-ok", 60)).toBeNull();
  });

  it("fails OPEN when Redis is down", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await guardApiRequestShared(mkReq("9.9.9.4"), "shared-open", 60)).toBeNull();
  });
});
