"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useDebounceValue } from "usehooks-ts";
import {
  importSubscription,
  detectSubscriptionFormat,
} from "@/app/actions/subscription";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

type Format = "surge" | "clash" | "v2ray" | "unknown";

const formatLabels: Record<string, string> = {
  surge: "Surge",
  clash: "Clash",
  v2ray: "V2Ray",
  unknown: "Unknown",
};

const formatVariants: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  surge: "default",
  clash: "secondary",
  v2ray: "outline",
  unknown: "destructive",
};

export function SubscriptionImport({
  trigger,
}: { trigger?: React.ReactNode } = {}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [formatOverride, setFormatOverride] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [debouncedContent] = useDebounceValue(content, 500);

  const { data: detectedFormat, isFetching: detecting } = useQuery({
    queryKey: ["detectFormat", debouncedContent],
    queryFn: () => detectSubscriptionFormat(debouncedContent),
    enabled: debouncedContent.trim().length > 0,
    staleTime: Infinity,
  });

  // When detection result arrives, reset override if it was set to auto
  useEffect(() => {
    if (detectedFormat && !formatOverride) {
      // Auto-detected, no override needed
    }
  }, [detectedFormat, formatOverride]);

  const activeFormat = formatOverride || detectedFormat;

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setContent(text);
        setFormatOverride("");
        if (!name) {
          setName(file.name.replace(/\.(conf|yaml|yml|txt)$/, ""));
        }
        setError(null);
      };
      reader.readAsText(file);
    },
    [name],
  );

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError("Please paste or upload subscription content.");
      return;
    }
    if (!name.trim()) {
      setError("Please enter a subscription name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const override =
        formatOverride && formatOverride !== "auto"
          ? (formatOverride as Format)
          : undefined;
      const subscriptionId = await importSubscription(
        content,
        name.trim(),
        override,
      );
      setOpen(false);
      setContent("");
      setName("");
      setFormatOverride("");
      router.push(`/subscriptions/${subscriptionId}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to import subscription.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setContent("");
    setName("");
    setFormatOverride("");
    setError(null);
    setLoading(false);
  };

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button onClick={() => setOpen(true)}>Import Subscription</Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/80 supports-backdrop-filter:backdrop-blur-xs"
            onClick={handleClose}
          />

          {/* Modal */}
          <Card className="relative z-10 w-full max-w-2xl mx-4">
            <CardHeader>
              <CardTitle className="text-lg">Import Subscription</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Name input */}
              <div className="space-y-2">
                <Label htmlFor="sub-name">Subscription Name</Label>
                <Input
                  id="sub-name"
                  placeholder="e.g. My Surge Config"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Content textarea */}
              <div className="space-y-2">
                <Label htmlFor="sub-content">Configuration Content</Label>
                <Textarea
                  id="sub-content"
                  placeholder="Paste your Surge, Clash, or V2Ray subscription content here..."
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setFormatOverride("");
                    setError(null);
                  }}
                  className="min-h-40 max-h-80 font-mono text-xs"
                />
              </div>

              {/* File upload */}
              <div className="space-y-2">
                <Label htmlFor="sub-file">Or upload a file</Label>
                <Input
                  id="sub-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".conf,.yaml,.yml,.txt"
                  onChange={handleFileUpload}
                />
              </div>

              {/* Format detection & override */}
              {content.trim().length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Detected:</span>
                    {detecting ? (
                      <span className="text-muted-foreground text-xs">
                        Detecting...
                      </span>
                    ) : detectedFormat ? (
                      <Badge variant={formatVariants[detectedFormat]}>
                        {formatLabels[detectedFormat]}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-sm text-muted-foreground">
                      Override:
                    </span>
                    <Select
                      value={formatOverride}
                      onValueChange={setFormatOverride}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Auto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="surge">Surge</SelectItem>
                        <SelectItem value="clash">Clash</SelectItem>
                        <SelectItem value="v2ray">V2Ray</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </CardContent>

            <CardFooter className="gap-2 justify-end">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  loading || !activeFormat || activeFormat === "unknown"
                }
              >
                {loading ? "Importing..." : "Import"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
}
