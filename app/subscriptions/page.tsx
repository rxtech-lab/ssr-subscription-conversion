import { getSubscriptions } from "@/app/actions/subscription";
import { SubscriptionList } from "@/components/subscription-list";
import { SubscriptionImport } from "@/components/subscription-import";

export default async function SubscriptionsPage() {
  const subscriptions = await getSubscriptions();

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Subscriptions</h1>
        <SubscriptionImport />
      </div>
      <SubscriptionList subscriptions={subscriptions} />
    </div>
  );
}
