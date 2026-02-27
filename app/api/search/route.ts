import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscriptions, proxyGroups } from "@/lib/db/schema";
import { eq, like, and } from "drizzle-orm";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json([], { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";
  const limit = parseInt(searchParams.get("limit") ?? "10", 10);

  if (!query.trim()) {
    return Response.json([]);
  }

  const pattern = `%${query}%`;

  const [subResults, groupResults] = await Promise.all([
    db
      .select({
        id: subscriptions.id,
        name: subscriptions.name,
        sourceType: subscriptions.sourceType,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, session.user.id),
          like(subscriptions.name, pattern)
        )
      )
      .limit(limit),
    db
      .select({
        id: proxyGroups.id,
        name: proxyGroups.name,
        type: proxyGroups.type,
        subscriptionId: proxyGroups.subscriptionId,
      })
      .from(proxyGroups)
      .innerJoin(
        subscriptions,
        eq(proxyGroups.subscriptionId, subscriptions.id)
      )
      .where(
        and(
          eq(subscriptions.userId, session.user.id),
          like(proxyGroups.name, pattern)
        )
      )
      .limit(limit),
  ]);

  const results = [
    ...subResults.map((s) => ({
      id: s.id,
      title: s.name,
      snippet: `Subscription (${s.sourceType})`,
      type: "subscription" as const,
      url: `/subscriptions/${s.id}`,
    })),
    ...groupResults.map((g) => ({
      id: g.id,
      title: g.name,
      snippet: `Proxy Group (${g.type})`,
      type: "proxy-group" as const,
      url: `/subscriptions/${g.subscriptionId}`,
    })),
  ];

  return Response.json(results);
}
