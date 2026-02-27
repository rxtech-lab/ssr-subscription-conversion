import { getSubscription, getLinks } from "@/app/actions/subscription";
import { SubscriptionDetail } from "@/components/subscription-detail";
import { notFound } from "next/navigation";

export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const [subscription, links] = await Promise.all([
      getSubscription(id),
      getLinks(id),
    ]);

    return (
      <div className="mx-auto max-w-4xl">
        <SubscriptionDetail subscription={subscription} links={links} />
      </div>
    );
  } catch {
    notFound();
  }
}
