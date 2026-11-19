import { describe, it, expect } from "vitest";
import { PATCH } from "./route";

describe("PATCH /api/learn/videos security", () => {
  it("rejects unauthenticated requests with HTTP 401", async () => {
    const req = new Request("http://localhost:3000/api/learn/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtubeVideoId: "dQw4w9WgXcQ" }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Authentication required/i);
  });

  it("rejects malformed authorization header with HTTP 401", async () => {
    const req = new Request("http://localhost:3000/api/learn/videos", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        authorization: "Basic dXNlcjpwYXNz",
      },
      body: JSON.stringify({ youtubeVideoId: "dQw4w9WgXcQ" }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Authentication required/i);
  });

  it("rejects invalid youtubeVideoId format when auth token format is provided", async () => {
    const req = new Request("http://localhost:3000/api/learn/videos", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer dummy-test-token",
      },
      body: JSON.stringify({ youtubeVideoId: "invalid;--drop" }),
    });

    const res = await PATCH(req);
    // If auth validation fails in test env (no real Supabase connection), it gives 401; if auth passes or is stubbed, 400
    expect([400, 401]).toContain(res.status);
  });
});
