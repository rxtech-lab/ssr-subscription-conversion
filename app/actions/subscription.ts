"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  subscriptions,
  servers,
  proxyGroups,
  rules,
  subscriptionLinks,
} from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { detectFormat } from "@/lib/subscription/detect";
import { parseSubscription } from "@/lib/subscription/parsers";
import { eq, and, desc, max } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { SubscriptionFormat, SubscriptionConfigWithIds } from "@/lib/subscription/types";

// ─── detectSubscriptionFormat ──────────────────────────────────────────────

export async function detectSubscriptionFormat(content: string): Promise<SubscriptionFormat> {
  return detectFormat(content);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function requireAuth(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }
  return session.user.id;
}

async function requireSubscriptionOwnership(subscriptionId: string, userId: string) {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.userId, userId)));

  if (!subscription) {
    throw new Error("Subscription not found or access denied");
  }
  return subscription;
}

// ─── importSubscription ─────────────────────────────────────────────────────

export async function importSubscription(content: string, name: string, formatOverride?: SubscriptionFormat) {
  const userId = await requireAuth();

  const format = formatOverride && formatOverride !== "unknown" ? formatOverride : detectFormat(content);
  if (format === "unknown") {
    throw new Error("Unable to detect subscription format");
  }

  const config = parseSubscription(content, format);

  // Insert subscription
  const subscriptionId = nanoid();
  await db.insert(subscriptions).values({
    id: subscriptionId,
    userId,
    name,
    sourceType: format,
    generalConfig: JSON.stringify(config.general),
  });

  // Insert servers
  for (let i = 0; i < config.servers.length; i++) {
    const srv = config.servers[i];
    const encryptedSettings = encrypt(
      JSON.stringify(srv.settings),
      process.env.AUTH_SECRET!
    );
    await db.insert(servers).values({
      subscriptionId,
      name: srv.name,
      type: srv.type,
      server: srv.server ?? null,
      port: srv.port ?? null,
      encryptedSettings,
      sortOrder: i,
    });
  }

  // Insert proxy groups
  for (let i = 0; i < config.proxyGroups.length; i++) {
    const group = config.proxyGroups[i];
    await db.insert(proxyGroups).values({
      subscriptionId,
      name: group.name,
      type: group.type,
      members: JSON.stringify(group.members),
      settings: JSON.stringify(group.settings),
      sortOrder: i,
    });
  }

  // Insert rules
  for (let i = 0; i < config.rules.length; i++) {
    const rule = config.rules[i];
    await db.insert(rules).values({
      subscriptionId,
      ruleType: rule.type,
      value: rule.value ?? null,
      target: rule.target,
      comment: rule.comment ?? null,
      sortOrder: i,
    });
  }

  return subscriptionId;
}

// ─── getSubscriptions ───────────────────────────────────────────────────────

export async function getSubscriptions() {
  const userId = await requireAuth();

  return db
    .select({
      id: subscriptions.id,
      name: subscriptions.name,
      sourceType: subscriptions.sourceType,
      createdAt: subscriptions.createdAt,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt));
}

// ─── getSubscription ────────────────────────────────────────────────────────

export async function getSubscription(id: string) {
  const userId = await requireAuth();

  const subscription = await requireSubscriptionOwnership(id, userId);

  // Load related data
  const [serverRows, groupRows, ruleRows] = await Promise.all([
    db
      .select()
      .from(servers)
      .where(eq(servers.subscriptionId, id))
      .orderBy(servers.sortOrder),
    db
      .select()
      .from(proxyGroups)
      .where(eq(proxyGroups.subscriptionId, id))
      .orderBy(proxyGroups.sortOrder),
    db
      .select()
      .from(rules)
      .where(eq(rules.subscriptionId, id))
      .orderBy(rules.sortOrder),
  ]);

  // Reconstruct SubscriptionConfig with IDs for CRUD
  const config: SubscriptionConfigWithIds = {
    general: subscription.generalConfig
      ? JSON.parse(subscription.generalConfig)
      : {},
    servers: serverRows.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      server: s.server ?? undefined,
      port: s.port ?? undefined,
      settings: s.encryptedSettings
        ? JSON.parse(decrypt(s.encryptedSettings, process.env.AUTH_SECRET!))
        : {},
    })),
    proxyGroups: groupRows.map((g) => ({
      id: g.id,
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

  return {
    id: subscription.id,
    name: subscription.name,
    sourceType: subscription.sourceType,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
    config,
  };
}

// ─── renameSubscription ─────────────────────────────────────────────────────

export async function renameSubscription(id: string, newName: string) {
  if (!newName.trim()) {
    throw new Error("Name cannot be empty");
  }

  const userId = await requireAuth();

  await requireSubscriptionOwnership(id, userId);

  await db
    .update(subscriptions)
    .set({ name: newName })
    .where(eq(subscriptions.id, id));
}

// ─── deleteSubscription ─────────────────────────────────────────────────────

export async function deleteSubscription(id: string) {
  const userId = await requireAuth();

  await requireSubscriptionOwnership(id, userId);

  // Cascade delete will remove servers, proxy_groups, rules, subscription_links
  await db.delete(subscriptions).where(eq(subscriptions.id, id));
}

// ─── generateLink ───────────────────────────────────────────────────────────

export async function generateLink(
  subscriptionId: string,
  targetType: string
) {
  const userId = await requireAuth();

  await requireSubscriptionOwnership(subscriptionId, userId);

  const token = nanoid();

  await db.insert(subscriptionLinks).values({
    subscriptionId,
    userId,
    targetType: targetType as "surge" | "clash" | "v2ray",
    token,
  });

  return token;
}

// ─── getLinks ───────────────────────────────────────────────────────────────

export async function getLinks(subscriptionId: string) {
  const userId = await requireAuth();

  await requireSubscriptionOwnership(subscriptionId, userId);

  const result = await db
    .select({
      id: subscriptionLinks.id,
      targetType: subscriptionLinks.targetType,
      token: subscriptionLinks.token,
      createdAt: subscriptionLinks.createdAt,
    })
    .from(subscriptionLinks)
    .where(eq(subscriptionLinks.subscriptionId, subscriptionId));

  return result;
}

// ─── deleteLink ─────────────────────────────────────────────────────────────

export async function deleteLink(id: string) {
  const userId = await requireAuth();

  // Query the link to verify ownership
  const [link] = await db
    .select()
    .from(subscriptionLinks)
    .where(
      and(eq(subscriptionLinks.id, id), eq(subscriptionLinks.userId, userId))
    );

  if (!link) {
    throw new Error("Link not found or access denied");
  }

  await db.delete(subscriptionLinks).where(eq(subscriptionLinks.id, id));
}

// ─── Server CRUD ─────────────────────────────────────────────────────────────

async function getMaxServerSortOrder(subscriptionId: string): Promise<number> {
  const [result] = await db
    .select({ maxOrder: max(servers.sortOrder) })
    .from(servers)
    .where(eq(servers.subscriptionId, subscriptionId));
  return (result?.maxOrder ?? -1) + 1;
}

export async function addServer(
  subscriptionId: string,
  data: {
    name: string;
    type: "ss" | "vmess" | "trojan" | "direct" | "reject";
    server?: string;
    port?: number;
    settings: Record<string, string | number | boolean>;
  }
) {
  const userId = await requireAuth();
  await requireSubscriptionOwnership(subscriptionId, userId);

  const sortOrder = await getMaxServerSortOrder(subscriptionId);
  const encryptedSettings = encrypt(
    JSON.stringify(data.settings),
    process.env.AUTH_SECRET!
  );

  await db.insert(servers).values({
    subscriptionId,
    name: data.name,
    type: data.type,
    server: data.server ?? null,
    port: data.port ?? null,
    encryptedSettings,
    sortOrder,
  });
}

export async function updateServer(
  serverId: string,
  data: {
    name?: string;
    type?: "ss" | "vmess" | "trojan" | "direct" | "reject";
    server?: string | null;
    port?: number | null;
    settings?: Record<string, string | number | boolean>;
  }
) {
  const userId = await requireAuth();

  // Verify ownership via server → subscription → user
  const [serverRow] = await db
    .select()
    .from(servers)
    .where(eq(servers.id, serverId));

  if (!serverRow) throw new Error("Server not found");
  await requireSubscriptionOwnership(serverRow.subscriptionId, userId);

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.type !== undefined) updates.type = data.type;
  if (data.server !== undefined) updates.server = data.server;
  if (data.port !== undefined) updates.port = data.port;
  if (data.settings !== undefined) {
    updates.encryptedSettings = encrypt(
      JSON.stringify(data.settings),
      process.env.AUTH_SECRET!
    );
  }

  await db.update(servers).set(updates).where(eq(servers.id, serverId));
}

export async function deleteServer(serverId: string) {
  const userId = await requireAuth();

  const [serverRow] = await db
    .select()
    .from(servers)
    .where(eq(servers.id, serverId));

  if (!serverRow) throw new Error("Server not found");
  await requireSubscriptionOwnership(serverRow.subscriptionId, userId);

  await db.delete(servers).where(eq(servers.id, serverId));
}

// ─── Proxy Group CRUD ────────────────────────────────────────────────────────

async function getMaxGroupSortOrder(subscriptionId: string): Promise<number> {
  const [result] = await db
    .select({ maxOrder: max(proxyGroups.sortOrder) })
    .from(proxyGroups)
    .where(eq(proxyGroups.subscriptionId, subscriptionId));
  return (result?.maxOrder ?? -1) + 1;
}

export async function addProxyGroup(
  subscriptionId: string,
  data: {
    name: string;
    type: "select" | "url-test" | "fallback" | "load-balance";
    members: string[];
    settings: Record<string, string | number | boolean>;
  }
) {
  const userId = await requireAuth();
  await requireSubscriptionOwnership(subscriptionId, userId);

  const sortOrder = await getMaxGroupSortOrder(subscriptionId);

  await db.insert(proxyGroups).values({
    subscriptionId,
    name: data.name,
    type: data.type,
    members: JSON.stringify(data.members),
    settings: JSON.stringify(data.settings),
    sortOrder,
  });
}

export async function updateProxyGroup(
  groupId: string,
  data: {
    name?: string;
    type?: "select" | "url-test" | "fallback" | "load-balance";
    members?: string[];
    settings?: Record<string, string | number | boolean>;
  }
) {
  const userId = await requireAuth();

  const [groupRow] = await db
    .select()
    .from(proxyGroups)
    .where(eq(proxyGroups.id, groupId));

  if (!groupRow) throw new Error("Proxy group not found");
  await requireSubscriptionOwnership(groupRow.subscriptionId, userId);

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.type !== undefined) updates.type = data.type;
  if (data.members !== undefined) updates.members = JSON.stringify(data.members);
  if (data.settings !== undefined) updates.settings = JSON.stringify(data.settings);

  await db.update(proxyGroups).set(updates).where(eq(proxyGroups.id, groupId));
}

export async function deleteProxyGroup(groupId: string) {
  const userId = await requireAuth();

  const [groupRow] = await db
    .select()
    .from(proxyGroups)
    .where(eq(proxyGroups.id, groupId));

  if (!groupRow) throw new Error("Proxy group not found");
  await requireSubscriptionOwnership(groupRow.subscriptionId, userId);

  await db.delete(proxyGroups).where(eq(proxyGroups.id, groupId));
}

// ─── Rule CRUD ──────────────────────────────────────────────────────────────

async function getMaxRuleSortOrder(subscriptionId: string): Promise<number> {
  const [result] = await db
    .select({ maxOrder: max(rules.sortOrder) })
    .from(rules)
    .where(eq(rules.subscriptionId, subscriptionId));
  return (result?.maxOrder ?? -1) + 1;
}

export async function addRule(
  subscriptionId: string,
  data: {
    ruleType: string;
    value?: string;
    target: string;
    comment?: string;
  }
) {
  const userId = await requireAuth();
  await requireSubscriptionOwnership(subscriptionId, userId);

  const sortOrder = await getMaxRuleSortOrder(subscriptionId);

  await db.insert(rules).values({
    subscriptionId,
    ruleType: data.ruleType,
    value: data.value ?? null,
    target: data.target,
    comment: data.comment ?? null,
    sortOrder,
  });
}

export async function updateRule(
  ruleId: string,
  data: {
    ruleType?: string;
    value?: string | null;
    target?: string;
    comment?: string | null;
  }
) {
  const userId = await requireAuth();

  const [ruleRow] = await db
    .select()
    .from(rules)
    .where(eq(rules.id, ruleId));

  if (!ruleRow) throw new Error("Rule not found");
  await requireSubscriptionOwnership(ruleRow.subscriptionId, userId);

  const updates: Record<string, unknown> = {};
  if (data.ruleType !== undefined) updates.ruleType = data.ruleType;
  if (data.value !== undefined) updates.value = data.value;
  if (data.target !== undefined) updates.target = data.target;
  if (data.comment !== undefined) updates.comment = data.comment;

  await db.update(rules).set(updates).where(eq(rules.id, ruleId));
}

export async function deleteRule(ruleId: string) {
  const userId = await requireAuth();

  const [ruleRow] = await db
    .select()
    .from(rules)
    .where(eq(rules.id, ruleId));

  if (!ruleRow) throw new Error("Rule not found");
  await requireSubscriptionOwnership(ruleRow.subscriptionId, userId);

  await db.delete(rules).where(eq(rules.id, ruleId));
}

// ─── Import helpers ──────────────────────────────────────────────────────────

export async function getSubscriptionItems(subscriptionId: string) {
  const userId = await requireAuth();
  await requireSubscriptionOwnership(subscriptionId, userId);

  const [serverRows, groupRows] = await Promise.all([
    db
      .select()
      .from(servers)
      .where(eq(servers.subscriptionId, subscriptionId))
      .orderBy(servers.sortOrder),
    db
      .select()
      .from(proxyGroups)
      .where(eq(proxyGroups.subscriptionId, subscriptionId))
      .orderBy(proxyGroups.sortOrder),
  ]);

  return {
    servers: serverRows.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      server: s.server ?? undefined,
      port: s.port ?? undefined,
      settings: s.encryptedSettings
        ? JSON.parse(decrypt(s.encryptedSettings, process.env.AUTH_SECRET!))
        : {},
    })),
    proxyGroups: groupRows.map((g) => ({
      id: g.id,
      name: g.name,
      type: g.type,
      members: g.members ? JSON.parse(g.members) : [],
      settings: g.settings ? JSON.parse(g.settings) : {},
    })),
  };
}

export async function importItems(
  targetSubscriptionId: string,
  sourceSubscriptionId: string,
  serverIds: string[],
  groupIds: string[]
) {
  const userId = await requireAuth();

  // Verify ownership of both subscriptions
  await Promise.all([
    requireSubscriptionOwnership(targetSubscriptionId, userId),
    requireSubscriptionOwnership(sourceSubscriptionId, userId),
  ]);

  // Import servers
  if (serverIds.length > 0) {
    let sortOrder = await getMaxServerSortOrder(targetSubscriptionId);

    for (const serverId of serverIds) {
      const [serverRow] = await db
        .select()
        .from(servers)
        .where(
          and(
            eq(servers.id, serverId),
            eq(servers.subscriptionId, sourceSubscriptionId)
          )
        );
      if (!serverRow) continue;

      await db.insert(servers).values({
        subscriptionId: targetSubscriptionId,
        name: serverRow.name,
        type: serverRow.type,
        server: serverRow.server,
        port: serverRow.port,
        encryptedSettings: serverRow.encryptedSettings,
        sortOrder: sortOrder++,
      });
    }
  }

  // Import proxy groups
  if (groupIds.length > 0) {
    let sortOrder = await getMaxGroupSortOrder(targetSubscriptionId);

    for (const groupId of groupIds) {
      const [groupRow] = await db
        .select()
        .from(proxyGroups)
        .where(
          and(
            eq(proxyGroups.id, groupId),
            eq(proxyGroups.subscriptionId, sourceSubscriptionId)
          )
        );
      if (!groupRow) continue;

      await db.insert(proxyGroups).values({
        subscriptionId: targetSubscriptionId,
        name: groupRow.name,
        type: groupRow.type,
        members: groupRow.members,
        settings: groupRow.settings,
        sortOrder: sortOrder++,
      });
    }
  }
}
