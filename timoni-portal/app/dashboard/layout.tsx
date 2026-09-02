import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import StoreSwitcher from "./store-switcher";
import PortalHeader from "@/components/portal-header";

const STORE_SWITCHER_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const email = session.user.email.trim().toLowerCase();
  const showStoreSwitcher = STORE_SWITCHER_EMAILS.has(email);

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader email={email} portalUser={session.portalUser} />

      {showStoreSwitcher && <StoreSwitcher />}

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        {children}
      </main>
    </div>
  );
}
