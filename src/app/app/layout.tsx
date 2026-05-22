import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getViewerContext } from "@/lib/viewer-context";
import { AppSidebar, MobileNav } from "./sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const context = await getViewerContext();

  const navProps = {
    showFinance: context?.financeVisible ?? false,
    isDemoMode: context?.isDemoMode ?? false,
  };

  return (
    <div className="flex min-h-screen flex-1">
      <AppSidebar {...navProps} />

      <div className="flex flex-1 flex-col min-w-0">
        <MobileNav {...navProps} />

        <main className="flex-1 w-full max-w-5xl mx-auto px-5 py-8 pb-safe sm:px-8 sm:py-10 lg:px-12 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
