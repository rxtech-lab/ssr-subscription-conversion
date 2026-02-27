"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteSubscription } from "@/app/actions/subscription";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
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

interface Subscription {
  id: string;
  name: string;
  sourceType: string;
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
  });
}

export function SubscriptionList({
  subscriptions,
}: {
  subscriptions: Subscription[];
}) {
  const router = useRouter();

  const handleDelete = async (id: string) => {
    try {
      await deleteSubscription(id);
      router.refresh();
    } catch {
      // Error handling silently — could add toast later
    }
  };

  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground text-lg">No subscriptions yet</p>
        <p className="text-muted-foreground text-sm mt-2">
          Import a Surge, Clash, or V2Ray subscription to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {subscriptions.map((sub) => (
        <Card key={sub.id} size="sm">
          <CardHeader>
            <CardTitle>
              <Link
                href={`/subscriptions/${sub.id}`}
                className="hover:underline underline-offset-4"
              >
                {sub.name}
              </Link>
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Badge variant={formatVariants[sub.sourceType] ?? "outline"}>
                {formatLabels[sub.sourceType] ?? sub.sourceType}
              </Badge>
              <span>Created {formatDate(sub.createdAt)}</span>
            </CardDescription>
            <CardAction>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/subscriptions/${sub.id}`}>View</Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete &ldquo;{sub.name}&rdquo;?
                        This will also remove all generated links. This action
                        cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => handleDelete(sub.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardAction>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
