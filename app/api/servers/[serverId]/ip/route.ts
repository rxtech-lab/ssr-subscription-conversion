import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { ApiAuthError, requireApiUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { servers, subscriptions } from "@/lib/db/schema";

const updateServerIpSchema = z.object({
  ipAddress: z
    .string()
    .trim()
    .refine((value) => isIP(value) !== 0, {
      message: "ipAddress must be a valid IPv4 or IPv6 address",
    }),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ serverId: string }> }
) {
  let userId: string;
  try {
    userId = await requireApiUserId(request);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const { serverId } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = updateServerIpSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const [serverRow] = await db
    .select({
      id: servers.id,
      subscriptionId: servers.subscriptionId,
    })
    .from(servers)
    .innerJoin(subscriptions, eq(servers.subscriptionId, subscriptions.id))
    .where(and(eq(servers.id, serverId), eq(subscriptions.userId, userId)))
    .limit(1);

  if (!serverRow) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  const now = Math.floor(Date.now() / 1000);

  await db
    .update(servers)
    .set({ server: parsed.data.ipAddress })
    .where(eq(servers.id, serverRow.id));

  await db
    .update(subscriptions)
    .set({ updatedAt: now })
    .where(eq(subscriptions.id, serverRow.subscriptionId));

  return NextResponse.json({
    success: true,
    serverId: serverRow.id,
    ipAddress: parsed.data.ipAddress,
  });
}
