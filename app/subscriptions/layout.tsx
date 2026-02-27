import { getSubscriptions } from "@/app/actions/subscription";
import { AppSidebar } from "@/components/app-sidebar";
import { SearchCommandWrapper } from "@/components/search-command-wrapper";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import "@rx-lab/dashboard-searching-ui/style.css";

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
        <header className="flex h-12 items-center border-b px-4">
          <SidebarTrigger />
          <div className="flex flex-1 justify-center">
            <SearchCommandWrapper />
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
