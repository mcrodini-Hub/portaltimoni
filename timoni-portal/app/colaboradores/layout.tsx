import { Suspense } from "react";
import { auth } from "@/lib/auth";
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
      <Suspense fallback={<><header aria-busy="true" aria-label="Carregando menu" className="fixed inset-x-0 top-0 z-[90] border-b border-blue-950/50 bg-[#0F2D8F] text-white shadow-sm"><div className="mx-auto flex h-10 max-w-7xl items-center px-4 text-base font-bold sm:h-12">Casa Timoni</div></header><div aria-hidden="true" className="h-16 sm:h-12" /></>}>
        <PortalHeader email={email} portalUser={session.portalUser} />
      </Suspense>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        {children}
      </main>
    </div>
  );
}
