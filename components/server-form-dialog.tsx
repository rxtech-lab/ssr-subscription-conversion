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
import { addServer, updateServer } from "@/app/actions/subscription";
import type { ServerWithId } from "@/lib/subscription/types";

const SERVER_TYPES = ["ss", "vmess", "trojan", "direct", "reject"] as const;

interface ServerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: string;
  server?: ServerWithId; // if provided, edit mode
}

export function ServerFormDialog({
  open,
  onOpenChange,
  subscriptionId,
  server,
}: ServerFormDialogProps) {
  const router = useRouter();
  const isEdit = !!server;

  const [name, setName] = useState("");
  const [type, setType] = useState<(typeof SERVER_TYPES)[number]>("ss");
  const [serverAddr, setServerAddr] = useState("");
  const [port, setPort] = useState("");
  const [settings, setSettings] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (server) {
        setName(server.name);
        setType(server.type);
        setServerAddr(server.server ?? "");
        setPort(server.port?.toString() ?? "");
        setSettings(
          Object.keys(server.settings).length > 0
            ? JSON.stringify(server.settings, null, 2)
            : ""
        );
      } else {
        setName("");
        setType("ss");
        setServerAddr("");
        setPort("");
        setSettings("");
      }
      setError(null);
    }
  }, [open, server]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

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
        server: serverAddr.trim() || undefined,
        port: port ? Number(port) : undefined,
        settings: parsedSettings,
      };

      if (isEdit && server) {
        await updateServer(server.id, {
          ...data,
          server: data.server ?? null,
          port: data.port ?? null,
        });
      } else {
        await addServer(subscriptionId, data);
      }

      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save server");
    } finally {
      setSaving(false);
    }
  };

  const needsAddress = type !== "direct" && type !== "reject";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Server" : "Add Server"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="server-name">Name</Label>
            <Input
              id="server-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Server"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="server-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVER_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {needsAddress && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="server-addr">Server Address</Label>
                <Input
                  id="server-addr"
                  value={serverAddr}
                  onChange={(e) => setServerAddr(e.target.value)}
                  placeholder="example.com"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="server-port">Port</Label>
                <Input
                  id="server-port"
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="443"
                />
              </div>
            </>
          )}

          <div className="grid gap-2">
            <Label htmlFor="server-settings">Settings (JSON)</Label>
            <Textarea
              id="server-settings"
              value={settings}
              onChange={(e) => setSettings(e.target.value)}
              placeholder='{"encrypt-method": "aes-256-gcm", "password": "..."}'
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
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Server"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
