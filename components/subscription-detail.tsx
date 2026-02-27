"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  PencilEdit01Icon,
  Delete01Icon,
  PlusSignIcon,
  Download01Icon,
} from "@hugeicons/core-free-icons";
import {
  deleteSubscription,
  generateLink,
  deleteLink,
  deleteServer,
  deleteProxyGroup,
} from "@/app/actions/subscription";
import { ServerFormDialog } from "@/components/server-form-dialog";
import { ProxyGroupFormDialog } from "@/components/proxy-group-form-dialog";
import { ImportFromConfigDialog } from "@/components/import-from-config-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { QRCodeSVG } from "qrcode.react";
import type {
  SubscriptionConfigWithIds,
  ServerWithId,
  ProxyGroupWithId,
} from "@/lib/subscription/types";

interface SubscriptionData {
  id: string;
  name: string;
  sourceType: string;
  createdAt: number | null;
  updatedAt: number | null;
  config: SubscriptionConfigWithIds;
}

interface LinkData {
  id: string;
  targetType: string;
  token: string;
  createdAt: number | null;
}

const formatLabels: Record<string, string> = {
  surge: "Surge",
  clash: "Clash",
  v2ray: "V2Ray",
};

const formatVariants: Record<string, "default" | "secondary" | "outline"> = {
  surge: "default",
  clash: "secondary",
  v2ray: "outline",
};

function formatDate(date: number | null): string {
  if (!date) return "Unknown";
  const d = new Date(date * 1000);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- Section Toggle Component ---

function Section({
  title,
  count,
  children,
  defaultOpen = false,
  actions,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div className="flex items-center justify-between py-3">
        <button
          onClick={() => setOpen(!open)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <span className="font-medium">{title}</span>
          <Badge variant="secondary">{count}</Badge>
          <span className="text-muted-foreground text-sm">
            {open ? "Hide" : "Show"}
          </span>
        </button>
        {actions && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

// --- Servers Table ---

function ServersSection({
  servers,
  subscriptionId,
}: {
  servers: ServerWithId[];
  subscriptionId: string;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editServer, setEditServer] = useState<ServerWithId | undefined>();

  const handleEdit = (server: ServerWithId) => {
    setEditServer(server);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditServer(undefined);
    setFormOpen(true);
  };

  const handleDelete = async (serverId: string) => {
    await deleteServer(serverId);
    router.refresh();
  };

  return (
    <>
      <Section
        title="Servers"
        count={servers.length}
        defaultOpen
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={handleAdd}>
              <HugeiconsIcon icon={PlusSignIcon} size={14} />
              Add
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
              <HugeiconsIcon icon={Download01Icon} size={14} />
              Import
            </Button>
          </>
        }
      >
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Server</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((server) => (
                <tr key={server.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{server.name}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className="uppercase text-[10px]">
                      {server.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {server.server && server.port
                      ? `${server.server}:${server.port}`
                      : server.server ?? "-"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleEdit(server)}
                      >
                        <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <HugeiconsIcon icon={Delete01Icon} size={14} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Server</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &ldquo;{server.name}&rdquo;?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => handleDelete(server.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
              {servers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">
                    No servers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <ServerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        subscriptionId={subscriptionId}
        server={editServer}
      />
      <ImportFromConfigDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        subscriptionId={subscriptionId}
      />
    </>
  );
}

// --- Proxy Groups Table ---

function ProxyGroupsSection({
  proxyGroups,
  subscriptionId,
}: {
  proxyGroups: ProxyGroupWithId[];
  subscriptionId: string;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<ProxyGroupWithId | undefined>();

  const handleEdit = (group: ProxyGroupWithId) => {
    setEditGroup(group);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditGroup(undefined);
    setFormOpen(true);
  };

  const handleDelete = async (groupId: string) => {
    await deleteProxyGroup(groupId);
    router.refresh();
  };

  return (
    <>
      <Section
        title="Proxy Groups"
        count={proxyGroups.length}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={handleAdd}>
              <HugeiconsIcon icon={PlusSignIcon} size={14} />
              Add
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
              <HugeiconsIcon icon={Download01Icon} size={14} />
              Import
            </Button>
          </>
        }
      >
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Members</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {proxyGroups.map((group) => (
                <tr key={group.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{group.name}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className="text-[10px]">
                      {group.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {group.members.length} member{group.members.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleEdit(group)}
                      >
                        <HugeiconsIcon icon={PencilEdit01Icon} size={14} />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <HugeiconsIcon icon={Delete01Icon} size={14} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Proxy Group</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &ldquo;{group.name}&rdquo;?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => handleDelete(group.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
              {proxyGroups.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">
                    No proxy groups found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <ProxyGroupFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        subscriptionId={subscriptionId}
        group={editGroup}
      />
      <ImportFromConfigDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        subscriptionId={subscriptionId}
      />
    </>
  );
}

// --- Rules Table ---

function RulesSection({ rules }: { rules: SubscriptionConfigWithIds["rules"] }) {
  return (
    <Section title="Rules" count={rules.length}>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-left font-medium">Value</th>
              <th className="px-4 py-2 text-left font-medium">Target</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="px-4 py-2">
                  <Badge variant="outline" className="text-[10px]">
                    {rule.type}
                  </Badge>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground max-w-xs truncate">
                  {rule.value ?? "-"}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{rule.target}</td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">
                  No rules found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// --- Links Management ---

function LinksSection({
  subscriptionId,
  links: initialLinks,
}: {
  subscriptionId: string;
  links: LinkData[];
}) {
  const router = useRouter();
  const [targetFormat, setTargetFormat] = useState("");
  const [generating, setGenerating] = useState(false);
  const [newlyGeneratedUrl, setNewlyGeneratedUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrCodeId, setQrCodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getSubscriptionUrl = useCallback(
    (token: string) => {
      if (typeof window === "undefined") return "";
      return `${window.location.origin}/api/sub/${token}`;
    },
    []
  );

  const handleGenerate = async () => {
    if (!targetFormat) {
      setError("Please select a target format.");
      return;
    }

    setGenerating(true);
    setError(null);
    setNewlyGeneratedUrl(null);

    try {
      const token = await generateLink(subscriptionId, targetFormat);
      const url = getSubscriptionUrl(token);
      setNewlyGeneratedUrl(url);
      setTargetFormat("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate link.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      await deleteLink(linkId);
      router.refresh();
    } catch {
      // Silent error handling
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback: select text
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription Links</CardTitle>
        <CardDescription>
          Generate links to access your subscription in different formats.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Generate new link */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Select value={targetFormat} onValueChange={setTargetFormat}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select target format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="surge">Surge</SelectItem>
                <SelectItem value="clash">Clash</SelectItem>
                <SelectItem value="v2ray">V2Ray</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? "Generating..." : "Generate Link"}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {newlyGeneratedUrl && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
            <p className="mb-2 text-sm font-medium text-green-800 dark:text-green-200">
              Link generated successfully!
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg bg-green-100 px-3 py-1.5 text-xs font-mono dark:bg-green-900">
                {newlyGeneratedUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(newlyGeneratedUrl, "new")}
              >
                {copiedId === "new" ? "Copied!" : "Copy"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQrCodeId(qrCodeId === "new" ? null : "new")}
              >
                QR
              </Button>
            </div>
            {qrCodeId === "new" && (
              <div className="mt-3 flex justify-center rounded-lg bg-white p-4">
                <QRCodeSVG value={newlyGeneratedUrl} size={180} />
              </div>
            )}
          </div>
        )}

        {/* Existing links */}
        {initialLinks.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Existing Links</h4>
              {initialLinks.map((link) => {
                const url = getSubscriptionUrl(link.token);
                const linkIdStr = String(link.id);
                return (
                  <div key={link.id} className="rounded-xl border">
                    <div className="flex items-center gap-3 p-3">
                      <Badge variant={formatVariants[link.targetType] ?? "outline"}>
                        {formatLabels[link.targetType] ?? link.targetType}
                      </Badge>
                      <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-mono text-muted-foreground">
                        {url}
                      </code>
                      <span className="hidden text-xs text-muted-foreground sm:inline">
                        {formatDate(link.createdAt)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(url, linkIdStr)}
                      >
                        {copiedId === linkIdStr ? "Copied!" : "Copy"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setQrCodeId(qrCodeId === linkIdStr ? null : linkIdStr)
                        }
                      >
                        QR
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Link</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this{" "}
                              {formatLabels[link.targetType] ?? link.targetType} link?
                              Anyone using this URL will lose access.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => handleDeleteLink(link.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    {qrCodeId === linkIdStr && (
                      <div className="flex justify-center border-t bg-muted/30 p-4">
                        <QRCodeSVG value={url} size={180} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --- Main Detail Component ---

export function SubscriptionDetail({
  subscription,
  links,
}: {
  subscription: SubscriptionData;
  links: LinkData[];
}) {
  const router = useRouter();

  const handleDeleteSubscription = async () => {
    try {
      await deleteSubscription(subscription.id);
      router.push("/subscriptions");
    } catch {
      // Silent error handling
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link href="/subscriptions">
              <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{subscription.name}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Badge
              variant={formatVariants[subscription.sourceType] ?? "outline"}
            >
              {formatLabels[subscription.sourceType] ?? subscription.sourceType}
            </Badge>
            <span>Created {formatDate(subscription.createdAt)}</span>
            {subscription.updatedAt && (
              <span>Updated {formatDate(subscription.updatedAt)}</span>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Config Sections */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Servers, proxy groups, and rules parsed from your subscription.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <ServersSection
            servers={subscription.config.servers}
            subscriptionId={subscription.id}
          />
          <Separator />
          <ProxyGroupsSection
            proxyGroups={subscription.config.proxyGroups}
            subscriptionId={subscription.id}
          />
          <Separator />
          <RulesSection rules={subscription.config.rules} />
        </CardContent>
      </Card>

      {/* Links Section */}
      <LinksSection subscriptionId={subscription.id} links={links} />

      {/* Danger Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardAction>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete Subscription</Button>
              </AlertDialogTrigger>
              <AlertDialogContent size="sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &ldquo;{subscription.name}
                    &rdquo;? This will permanently remove the subscription, all
                    servers, rules, and generated links. This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleDeleteSubscription}
                  >
                    Delete Permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardAction>
        </CardHeader>
      </Card>
    </div>
  );
}
