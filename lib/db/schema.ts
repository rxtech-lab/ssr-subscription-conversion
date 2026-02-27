import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { nanoid } from "nanoid";

// ─── Subscriptions ───────────────────────────────────────────────────────────

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  sourceType: text("source_type", {
    enum: ["surge", "clash", "v2ray"],
  }).notNull(),
  generalConfig: text("general_config"),
  createdAt: integer("created_at").$defaultFn(() =>
    Math.floor(Date.now() / 1000)
  ),
  updatedAt: integer("updated_at").$defaultFn(() =>
    Math.floor(Date.now() / 1000)
  ),
});

export const subscriptionsRelations = relations(subscriptions, ({ many }) => ({
  servers: many(servers),
  proxyGroups: many(proxyGroups),
  rules: many(rules),
  subscriptionLinks: many(subscriptionLinks),
}));

// ─── Servers ─────────────────────────────────────────────────────────────────

export const servers = sqliteTable("servers", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  subscriptionId: text("subscription_id")
    .notNull()
    .references(() => subscriptions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["ss", "vmess", "trojan", "direct", "reject"],
  }).notNull(),
  server: text("server"),
  port: integer("port"),
  encryptedSettings: text("encrypted_settings"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const serversRelations = relations(servers, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [servers.subscriptionId],
    references: [subscriptions.id],
  }),
}));

// ─── Proxy Groups ────────────────────────────────────────────────────────────

export const proxyGroups = sqliteTable("proxy_groups", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  subscriptionId: text("subscription_id")
    .notNull()
    .references(() => subscriptions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["select", "url-test", "fallback", "load-balance"],
  }).notNull(),
  members: text("members"),
  settings: text("settings"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const proxyGroupsRelations = relations(proxyGroups, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [proxyGroups.subscriptionId],
    references: [subscriptions.id],
  }),
}));

// ─── Rules ───────────────────────────────────────────────────────────────────

export const rules = sqliteTable("rules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  subscriptionId: text("subscription_id")
    .notNull()
    .references(() => subscriptions.id, { onDelete: "cascade" }),
  ruleType: text("rule_type").notNull(),
  value: text("value"),
  target: text("target").notNull(),
  comment: text("comment"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const rulesRelations = relations(rules, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [rules.subscriptionId],
    references: [subscriptions.id],
  }),
}));

// ─── Subscription Links ─────────────────────────────────────────────────────

export const subscriptionLinks = sqliteTable("subscription_links", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  subscriptionId: text("subscription_id")
    .notNull()
    .references(() => subscriptions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  targetType: text("target_type", {
    enum: ["surge", "clash", "v2ray"],
  }).notNull(),
  token: text("token").unique().notNull(),
  createdAt: integer("created_at").$defaultFn(() =>
    Math.floor(Date.now() / 1000)
  ),
});

export const subscriptionLinksRelations = relations(
  subscriptionLinks,
  ({ one }) => ({
    subscription: one(subscriptions, {
      fields: [subscriptionLinks.subscriptionId],
      references: [subscriptions.id],
    }),
  })
);
