import { getSubscriptions } from "@/app/actions/subscription";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export default async function SubscriptionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const subscriptions = await getSubscriptions();

  return (
    <SidebarProvider>
      <AppSidebar subscriptions={subscriptions} />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
