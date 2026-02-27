import { getSubscriptions } from "@/app/actions/subscription";
import { SubscriptionList } from "@/components/subscription-list";

export default async function SubscriptionsPage() {
  const subscriptions = await getSubscriptions();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold mb-8">My Subscriptions</h1>
      <SubscriptionList subscriptions={subscriptions} />
    </div>
  );
}
