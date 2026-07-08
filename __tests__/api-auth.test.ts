import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => null),
}));

import {
  clearUserinfoEndpointCache,
  getBearerToken,
  getOAuthUserIdFromBearerToken,
} from "@/lib/api-auth";

const originalFetch = globalThis.fetch;

function mockFetch() {
  const fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
  clearUserinfoEndpointCache();
  globalThis.fetch = originalFetch;
  delete process.env.AUTH_ISSUER;
});

describe("api auth", () => {
  it("extracts bearer tokens from authorization headers", () => {
    const request = new Request("https://example.test", {
      headers: {
        Authorization: "Bearer token-123",
      },
    });

    expect(getBearerToken(request)).toBe("token-123");
  });

  it("returns null when the authorization header is not a bearer token", () => {
    const request = new Request("https://example.test", {
      headers: {
        Authorization: "Basic token-123",
      },
    });

    expect(getBearerToken(request)).toBeNull();
  });

  it("uses OAuth discovery and userinfo to resolve bearer-token users", async () => {
    process.env.AUTH_ISSUER = "https://auth.example.test";
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(
        Response.json({
          userinfo_endpoint: "https://auth.example.test/api/oauth/userinfo",
        })
      )
      .mockResolvedValueOnce(Response.json({ sub: "oauth:user-2" }));

    await expect(getOAuthUserIdFromBearerToken("access-token")).resolves.toBe(
      "oauth:user-2"
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://auth.example.test/api/oauth/userinfo",
      {
        headers: {
          Authorization: "Bearer access-token",
        },
        cache: "no-store",
      }
    );
  });

  it("falls back to the RxLab userinfo path when discovery fails", async () => {
    process.env.AUTH_ISSUER = "https://auth.example.test/";
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ sub: "oauth:user-3" }));

    await expect(getOAuthUserIdFromBearerToken("access-token")).resolves.toBe(
      "oauth:user-3"
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://auth.example.test/api/oauth/userinfo",
      {
        headers: {
          Authorization: "Bearer access-token",
        },
        cache: "no-store",
      }
    );
  });

  it("rejects invalid OAuth bearer tokens", async () => {
    process.env.AUTH_ISSUER = "https://auth.example.test";
    const fetchMock = mockFetch();
    fetchMock
      .mockResolvedValueOnce(
        Response.json({
          userinfo_endpoint: "https://auth.example.test/api/oauth/userinfo",
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(getOAuthUserIdFromBearerToken("bad-token")).resolves.toBeNull();
  });
});
