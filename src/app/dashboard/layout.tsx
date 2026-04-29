import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuthProvider } from "@/lib/auth/hooks";
import { DashboardTopNav } from "@/components/layout/DashboardTopNav";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { MobileSidebar, Sidebar } from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("x-user-id");
  if (!userId) redirect("/login");

  return (
    <AuthProvider>
      <div className="min-h-screen bg-background md:grid md:grid-cols-[18.5rem_minmax(0,1fr)]">
        <aside className="hidden border-r border-border bg-background/80 md:sticky md:top-0 md:block md:h-screen">
          <Sidebar />
        </aside>

        <main className="min-w-0">
          <div className="flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm md:hidden">
            <div>
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                AI Content Studio
              </p>
              <p className="mt-1 text-[0.9375rem] font-semibold tracking-[-0.01em]">Креатив-студия</p>
            </div>
            <MobileSidebar />
          </div>

          <DashboardTopNav />

          <div className="mx-auto w-full max-w-[94rem] px-4 py-6 md:px-8 md:py-8">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
    </AuthProvider>
  );
}
