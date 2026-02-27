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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addProxyGroup, updateProxyGroup } from "@/app/actions/subscription";
import type { ProxyGroupWithId } from "@/lib/subscription/types";

const GROUP_TYPES = ["select", "url-test", "fallback", "load-balance"] as const;

interface ProxyGroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: string;
  group?: ProxyGroupWithId; // if provided, edit mode
}

export function ProxyGroupFormDialog({
  open,
  onOpenChange,
  subscriptionId,
  group,
}: ProxyGroupFormDialogProps) {
  const router = useRouter();
  const isEdit = !!group;

  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof GROUP_TYPES)[number]>("select");
  const [members, setMembers] = useState("");
  const [settings, setSettings] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (group) {
        setName(group.name);
        setType(group.type);
        setMembers(group.members.join("\n"));
        setSettings(
          Object.keys(group.settings).length > 0
            ? JSON.stringify(group.settings, null, 2)
            : ""
        );
      } else {
        setName("");
        setType("select");
        setMembers("");
        setSettings("");
      }
      setError(null);
    }
  }, [open, group]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    const memberList = members
      .split(/[\n,]/)
      .map((m) => m.trim())
      .filter(Boolean);

    let parsedSettings: Record<string, string | number | boolean> = {};
    if (settings.trim()) {
      try {
        parsedSettings = JSON.parse(settings.trim());
      } catch {
        setError("Settings must be valid JSON");
        return;
      }
    }

    setSaving(true);
    setError(null);

    try {
      const data = {
        name: name.trim(),
        type,
        members: memberList,
        settings: parsedSettings,
      };

      if (isEdit && group) {
        await updateProxyGroup(group.id, data);
      } else {
        await addProxyGroup(subscriptionId, data);
      }

      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save proxy group"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Proxy Group" : "Add Proxy Group"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Proxy"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="group-type">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as typeof type)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="group-members">
              Members (one per line or comma-separated)
            </Label>
            <Textarea
              id="group-members"
              value={members}
              onChange={(e) => setMembers(e.target.value)}
              placeholder={"Server 1\nServer 2\nServer 3"}
              className="font-mono text-xs"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="group-settings">Settings (JSON)</Label>
            <Textarea
              id="group-settings"
              value={settings}
              onChange={(e) => setSettings(e.target.value)}
              placeholder='{"url": "http://www.gstatic.com/generate_204", "interval": 300}'
              className="font-mono text-xs"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving
              ? "Saving..."
              : isEdit
                ? "Save Changes"
                : "Add Proxy Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
