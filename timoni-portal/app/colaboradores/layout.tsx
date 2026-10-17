import { Suspense } from "react";
import { getPortalSession as auth } from "@/lib/portal-session";
import { redirect } from "next/navigation";
import PortalHeader from "@/components/portal-header";

export default async function ColaboradoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const email = session.user.email.trim().toLowerCase();

  return (
    <div className="min-h-screen bg-slate-50">
      <Suspense fallback={<><div aria-busy="true" aria-label="Carregando menu" className="fixed inset-x-0 top-0 z-[90] h-16 bg-[#0F2D8F] sm:h-12" /><div aria-hidden="true" className="h-16 sm:h-12" /></>}><PortalHeader email={email} portalUser={session.portalUser} /></Suspense>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        {children}
      </main>
    </div>
  );
}
