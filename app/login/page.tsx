import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/subscriptions");
  }
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-bold">Subscription Converter</h1>
        <p className="text-muted-foreground">
          Convert between Surge, Clash, and V2Ray formats
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("rxlab");
          }}
        >
          <Button type="submit" className="w-full">
            Sign in with RxLab
          </Button>
        </form>
      </div>
    </div>
  );
}
