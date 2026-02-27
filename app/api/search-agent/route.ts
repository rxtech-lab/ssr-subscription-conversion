import { streamText, tool, gateway, convertToModelMessages, stepCountIs } from "ai";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { MODEL_ID, SYSTEM_PROMPT } from "@/lib/ai/config";
import {
  getSubscriptions,
  getSubscription,
  addProxyGroup,
  updateProxyGroup,
  deleteProxyGroup,
  addServer,
  updateServer,
  deleteServer,
  deleteSubscription,
  generateLink,
  getLinks,
  deleteLink,
  addRule,
  updateRule,
  deleteRule,
} from "@/app/actions/subscription";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = await req.json();
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: gateway(MODEL_ID),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    providerOptions: {
      google: { thinkingConfig: { thinkingBudget: 0 } },
      vertex: { thinkingConfig: { thinkingBudget: 0 } },
    },
    tools: {
      list_subscriptions: tool({
        description: "List all subscriptions for the current user",
        inputSchema: z.object({}),
        execute: async () => {
          const subs = await getSubscriptions();
          return { subscriptions: subs };
        },
      }),

      get_subscription: tool({
        description:
          "Get full details of a subscription including servers, proxy groups, and rules",
        inputSchema: z.object({
          subscriptionId: z.string().describe("The subscription ID"),
        }),
        execute: async ({ subscriptionId }) => {
          const sub = await getSubscription(subscriptionId);
          return sub;
        },
      }),

      add_proxy_group: tool({
        description: "Add a new proxy group to a subscription",
        inputSchema: z.object({
          subscriptionId: z.string().describe("The subscription ID"),
          name: z.string().describe("Name of the proxy group"),
          type: z.enum(["select", "url-test", "fallback", "load-balance"]),
          members: z
            .array(z.string())
            .describe("List of server/group names"),
          settings: z
            .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
            .default({}),
        }),
        execute: async ({ subscriptionId, name, type, members, settings }) => {
          await addProxyGroup(subscriptionId, { name, type, members, settings });
          return { success: true };
        },
      }),

      update_proxy_group: tool({
        description: "Update an existing proxy group",
        inputSchema: z.object({
          groupId: z.string().describe("The proxy group ID"),
          name: z.string().optional(),
          type: z
            .enum(["select", "url-test", "fallback", "load-balance"])
            .optional(),
          members: z.array(z.string()).optional(),
          settings: z
            .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
            .optional(),
        }),
        execute: async ({ groupId, ...data }) => {
          await updateProxyGroup(groupId, data);
          return { success: true };
        },
      }),

      delete_proxy_group: tool({
        description: "Delete a proxy group by ID",
        inputSchema: z.object({
          groupId: z.string().describe("The proxy group ID to delete"),
        }),
        execute: async ({ groupId }) => {
          await deleteProxyGroup(groupId);
          return { success: true };
        },
      }),

      add_server: tool({
        description: "Add a new server to a subscription",
        inputSchema: z.object({
          subscriptionId: z.string().describe("The subscription ID"),
          name: z.string().describe("Name of the server"),
          type: z.enum(["ss", "vmess", "trojan", "direct", "reject"]),
          server: z.string().optional().describe("Server hostname or IP"),
          port: z.number().optional().describe("Server port"),
          settings: z
            .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
            .default({}),
        }),
        execute: async ({ subscriptionId, name, type, server, port, settings }) => {
          await addServer(subscriptionId, { name, type, server, port, settings });
          return { success: true };
        },
      }),

      update_server: tool({
        description: "Update an existing server",
        inputSchema: z.object({
          serverId: z.string().describe("The server ID"),
          name: z.string().optional(),
          type: z.enum(["ss", "vmess", "trojan", "direct", "reject"]).optional(),
          server: z.string().nullable().optional(),
          port: z.number().nullable().optional(),
          settings: z
            .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
            .optional(),
        }),
        execute: async ({ serverId, ...data }) => {
          await updateServer(serverId, data);
          return { success: true };
        },
      }),

      delete_server: tool({
        description: "Delete a server by ID",
        inputSchema: z.object({
          serverId: z.string().describe("The server ID to delete"),
        }),
        execute: async ({ serverId }) => {
          await deleteServer(serverId);
          return { success: true };
        },
      }),

      delete_subscription: tool({
        description: "Delete an entire subscription and all its data",
        inputSchema: z.object({
          subscriptionId: z
            .string()
            .describe("The subscription ID to delete"),
        }),
        execute: async ({ subscriptionId }) => {
          await deleteSubscription(subscriptionId);
          return { success: true };
        },
      }),

      generate_link: tool({
        description:
          "Generate a subscription link for a specific format (surge, clash, or v2ray)",
        inputSchema: z.object({
          subscriptionId: z.string().describe("The subscription ID"),
          targetType: z
            .enum(["surge", "clash", "v2ray"])
            .describe("The target format"),
        }),
        execute: async ({ subscriptionId, targetType }) => {
          const token = await generateLink(subscriptionId, targetType);
          return { token };
        },
      }),

      get_links: tool({
        description: "Get all generated links for a subscription",
        inputSchema: z.object({
          subscriptionId: z.string().describe("The subscription ID"),
        }),
        execute: async ({ subscriptionId }) => {
          const links = await getLinks(subscriptionId);
          return { links };
        },
      }),

      delete_link: tool({
        description: "Delete a subscription link by ID",
        inputSchema: z.object({
          linkId: z.string().describe("The link ID to delete"),
        }),
        execute: async ({ linkId }) => {
          await deleteLink(linkId);
          return { success: true };
        },
      }),

      add_rule: tool({
        description:
          "Add a routing rule to a subscription. Rule types include: DOMAIN-SUFFIX, DOMAIN, DOMAIN-KEYWORD, IP-CIDR, GEOIP, FINAL, USER-AGENT, URL-REGEX, etc.",
        inputSchema: z.object({
          subscriptionId: z.string().describe("The subscription ID"),
          ruleType: z
            .string()
            .describe(
              "Rule type (e.g. DOMAIN-SUFFIX, DOMAIN, DOMAIN-KEYWORD, IP-CIDR, GEOIP, FINAL)"
            ),
          value: z
            .string()
            .optional()
            .describe("Match value (not needed for FINAL)"),
          target: z
            .string()
            .describe("Target proxy group name to route traffic to"),
          comment: z.string().optional().describe("Optional comment"),
        }),
        execute: async ({ subscriptionId, ...data }) => {
          await addRule(subscriptionId, data);
          return { success: true };
        },
      }),

      update_rule: tool({
        description: "Update an existing routing rule",
        inputSchema: z.object({
          ruleId: z.string().describe("The rule ID"),
          ruleType: z.string().optional(),
          value: z.string().nullable().optional(),
          target: z.string().optional(),
          comment: z.string().nullable().optional(),
        }),
        execute: async ({ ruleId, ...data }) => {
          await updateRule(ruleId, data);
          return { success: true };
        },
      }),

      delete_rule: tool({
        description: "Delete a routing rule by ID",
        inputSchema: z.object({
          ruleId: z.string().describe("The rule ID to delete"),
        }),
        execute: async ({ ruleId }) => {
          await deleteRule(ruleId);
          return { success: true };
        },
      }),
    },
    stopWhen: stepCountIs(20),
  });

  return result.toUIMessageStreamResponse();
}
