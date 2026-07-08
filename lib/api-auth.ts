import { auth } from "@/lib/auth";

type UserInfoProfile = {
  sub?: unknown;
};

let userinfoEndpointPromise: Promise<string> | null = null;

export class ApiAuthError extends Error {
  status = 401;

  constructor(message = "Unauthorized") {
    super(message);
    this.name = "ApiAuthError";
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function clearUserinfoEndpointCache() {
  userinfoEndpointPromise = null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function discoverUserinfoEndpoint(issuer: string): Promise<string> {
  const issuerBase = trimTrailingSlash(issuer);
  const fallbackEndpoint = `${issuerBase}/api/oauth/userinfo`;

  try {
    const response = await fetch(
      `${issuerBase}/.well-known/openid-configuration`,
      { cache: "force-cache" }
    );
    if (!response.ok) return fallbackEndpoint;

    const metadata: unknown = await response.json();
    if (
      isRecord(metadata) &&
      typeof metadata.userinfo_endpoint === "string" &&
      metadata.userinfo_endpoint.length > 0
    ) {
      return metadata.userinfo_endpoint;
    }
  } catch {
    return fallbackEndpoint;
  }

  return fallbackEndpoint;
}

async function getUserinfoEndpoint(): Promise<string> {
  const issuer = process.env.AUTH_ISSUER;
  if (!issuer) {
    throw new ApiAuthError("OAuth issuer is not configured");
  }

  userinfoEndpointPromise ??= discoverUserinfoEndpoint(issuer);
  return userinfoEndpointPromise;
}

export async function getOAuthUserIdFromBearerToken(
  token: string
): Promise<string | null> {
  const userinfoEndpoint = await getUserinfoEndpoint();

  const response = await fetch(userinfoEndpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const profile: UserInfoProfile = await response.json();
  return typeof profile.sub === "string" && profile.sub.length > 0
    ? profile.sub
    : null;
}

export async function requireApiUserId(request: Request): Promise<string> {
  const session = await auth();
  if (session?.user?.id) {
    return session.user.id;
  }

  const token = getBearerToken(request);
  if (!token) {
    throw new ApiAuthError();
  }

  const userId = await getOAuthUserIdFromBearerToken(token);
  if (!userId) {
    throw new ApiAuthError();
  }

  return userId;
}
