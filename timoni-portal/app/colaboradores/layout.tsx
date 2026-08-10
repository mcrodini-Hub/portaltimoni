import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import EspacoEquipeForm from "@/app/colaboradores/espaco-equipe-form";
import EspacoEquipeInbox from "@/app/colaboradores/espaco-equipe-inbox";
import PainelAlerts from "@/app/colaboradores/painel-alerts";
import PainelNotificationsClient from "@/app/painel-notifications-client";
import PortalHeader from "@/components/portal-header";
import { TEAM_MEMBERS } from "@/lib/team-members";

const GESTAO_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);

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
  const isGestao = GESTAO_EMAILS.has(email);

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader email={email} />

      <PainelNotificationsClient email={email} />

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        <PainelAlerts email={email} />
        {children}
        {isGestao ? <EspacoEquipeInbox /> : <EspacoEquipeForm members={TEAM_MEMBERS} />}
      </main>
    </div>
  );
}
