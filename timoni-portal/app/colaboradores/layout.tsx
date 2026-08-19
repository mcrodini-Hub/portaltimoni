import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import PainelAlerts from "@/app/colaboradores/painel-alerts";
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
      <PortalHeader email={email} />

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        <PainelAlerts email={email} />
        {children}
      </main>
    </div>
  );
}
