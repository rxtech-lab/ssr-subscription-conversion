import { db } from "@/lib/db";
import {
  subscriptionLinks,
  subscriptions,
  servers,
  proxyGroups,
  rules,
} from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { generateSubscription } from "@/lib/subscription/generators";
import { eq } from "drizzle-orm";
import type {
  SubscriptionConfig,
  SubscriptionFormat,
} from "@/lib/subscription/types";
import { NextResponse } from "next/server";

const CONTENT_TYPES: Record<string, string> = {
  surge: "text/plain",
  clash: "text/yaml; charset=utf-8",
  v2ray: "text/plain",
};

const FILE_EXTENSIONS: Record<string, string> = {
  surge: "conf",
  clash: "yaml",
  v2ray: "txt",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Look up the link by token
  const [link] = await db
    .select()
    .from(subscriptionLinks)
    .where(eq(subscriptionLinks.token, token));

  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Load the subscription
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, link.subscriptionId));

  if (!subscription) {
    return NextResponse.json(
      { error: "Subscription not found" },
      { status: 404 }
    );
  }

  // Load related data
  const [serverRows, groupRows, ruleRows] = await Promise.all([
    db
      .select()
      .from(servers)
      .where(eq(servers.subscriptionId, subscription.id))
      .orderBy(servers.sortOrder),
    db
      .select()
      .from(proxyGroups)
      .where(eq(proxyGroups.subscriptionId, subscription.id))
      .orderBy(proxyGroups.sortOrder),
    db
      .select()
      .from(rules)
      .where(eq(rules.subscriptionId, subscription.id))
      .orderBy(rules.sortOrder),
  ]);

  // Reconstruct SubscriptionConfig
  const config: SubscriptionConfig = {
    general: subscription.generalConfig
      ? JSON.parse(subscription.generalConfig)
      : {},
    servers: serverRows.map((s) => ({
      name: s.name,
      type: s.type,
      server: s.server ?? undefined,
      port: s.port ?? undefined,
      settings: s.encryptedSettings
        ? JSON.parse(decrypt(s.encryptedSettings, process.env.AUTH_SECRET!))
        : {},
    })),
    proxyGroups: groupRows.map((g) => ({
      name: g.name,
      type: g.type,
      members: g.members ? JSON.parse(g.members) : [],
      settings: g.settings ? JSON.parse(g.settings) : {},
    })),
    rules: ruleRows.map((r) => ({
      type: r.ruleType,
      value: r.value ?? undefined,
      target: r.target,
      comment: r.comment ?? undefined,
    })),
    hosts: [],
  };

  // Generate output
  const targetType = link.targetType as SubscriptionFormat;
  const output = generateSubscription(config, targetType);

  const contentType = CONTENT_TYPES[targetType] ?? "text/plain";
  const ext = FILE_EXTENSIONS[targetType] ?? "txt";
  const filename = `${subscription.name}.${ext}`;

  return new Response(output, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
