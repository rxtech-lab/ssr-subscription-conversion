"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getSubscriptions,
  getSubscriptionItems,
  importItems,
} from "@/app/actions/subscription";
import type { ServerWithId, ProxyGroupWithId } from "@/lib/subscription/types";

interface ImportFromConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: string;
}

type Step = "select-config" | "pick-items";

interface SubscriptionOption {
  id: string;
  name: string;
  sourceType: string;
}

export function ImportFromConfigDialog({
  open,
  onOpenChange,
  subscriptionId,
}: ImportFromConfigDialogProps) {
  const router = useRouter();

  const [step, setStep] = useState<Step>("select-config");
  const [configs, setConfigs] = useState<SubscriptionOption[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2 state
  const [sourceServers, setSourceServers] = useState<ServerWithId[]>([]);
  const [sourceGroups, setSourceGroups] = useState<ProxyGroupWithId[]>([]);
  const [selectedServerIds, setSelectedServerIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set()
  );

  // Load configs when dialog opens
  useEffect(() => {
    if (open) {
      setStep("select-config");
      setSelectedConfigId("");
      setError(null);
      setSourceServers([]);
      setSourceGroups([]);
      setSelectedServerIds(new Set());
      setSelectedGroupIds(new Set());

      getSubscriptions()
        .then((subs) => {
          setConfigs(subs.filter((s) => s.id !== subscriptionId));
        })
        .catch(() => setError("Failed to load subscriptions"));
    }
  }, [open, subscriptionId]);

  const handleNext = async () => {
    if (!selectedConfigId) {
      setError("Please select a config");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const items = await getSubscriptionItems(selectedConfigId);
      setSourceServers(items.servers as ServerWithId[]);
      setSourceGroups(items.proxyGroups as ProxyGroupWithId[]);
      setStep("pick-items");
    } catch {
      setError("Failed to load items from selected config");
    } finally {
      setLoading(false);
    }
  };

  const toggleServer = (id: string) => {
    setSelectedServerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllServers = () => {
    setSelectedServerIds(new Set(sourceServers.map((s) => s.id)));
  };

  const deselectAllServers = () => {
    setSelectedServerIds(new Set());
  };

  const selectAllGroups = () => {
    setSelectedGroupIds(new Set(sourceGroups.map((g) => g.id)));
  };

  const deselectAllGroups = () => {
    setSelectedGroupIds(new Set());
  };

  const handleImport = async () => {
    if (selectedServerIds.size === 0 && selectedGroupIds.size === 0) {
      setError("Please select at least one item to import");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      await importItems(
        subscriptionId,
        selectedConfigId,
        Array.from(selectedServerIds),
        Array.from(selectedGroupIds)
      );
      onOpenChange(false);
      router.refresh();
    } catch {
      setError("Failed to import items");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from Config</DialogTitle>
        </DialogHeader>

        {step === "select-config" && (
          <>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Select a subscription to import from</Label>
                <Select
                  value={selectedConfigId}
                  onValueChange={setSelectedConfigId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a config..." />
                  </SelectTrigger>
                  <SelectContent>
                    {configs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {configs.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No other subscriptions found.
                </p>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleNext}
                disabled={!selectedConfigId || loading}
              >
                {loading ? "Loading..." : "Next"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "pick-items" && (
          <>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto">
              {/* Servers */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Servers ({sourceServers.length})
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllServers}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={deselectAllServers}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
                {sourceServers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No servers in this config.
                  </p>
                ) : (
                  <div className="space-y-2 rounded-xl border p-3">
                    {sourceServers.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-3 text-sm"
                      >
                        <Checkbox
                          checked={selectedServerIds.has(s.id)}
                          onCheckedChange={() => toggleServer(s.id)}
                        />
                        <span className="font-mono text-xs">{s.name}</span>
                        <span className="text-muted-foreground text-xs uppercase">
                          {s.type}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Proxy Groups */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Proxy Groups ({sourceGroups.length})
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllGroups}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={deselectAllGroups}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
                {sourceGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No proxy groups in this config.
                  </p>
                ) : (
                  <div className="space-y-2 rounded-xl border p-3">
                    {sourceGroups.map((g) => (
                      <label
                        key={g.id}
                        className="flex items-center gap-3 text-sm"
                      >
                        <Checkbox
                          checked={selectedGroupIds.has(g.id)}
                          onCheckedChange={() => toggleGroup(g.id)}
                        />
                        <span className="font-mono text-xs">{g.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {g.type}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep("select-config")}
              >
                Back
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing
                  ? "Importing..."
                  : `Import Selected (${selectedServerIds.size + selectedGroupIds.size})`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
