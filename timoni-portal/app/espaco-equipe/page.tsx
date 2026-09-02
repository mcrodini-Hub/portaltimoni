import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import PortalHeader from "@/components/portal-header";
import EspacoEquipeForm from "@/app/colaboradores/espaco-equipe-form";
import EspacoEquipeInbox from "@/app/colaboradores/espaco-equipe-inbox";
import { getEffectiveCollaborators } from "@/lib/portal-config";

const GESTAO_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);

export default async function EspacoEquipePage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const email = session.user.email.trim().toLowerCase();
  const isGestao = GESTAO_EMAILS.has(email);
  const collaborators = isGestao ? [] : await getEffectiveCollaborators(session.accessToken);

  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader email={email} portalUser={session.portalUser} />
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        {isGestao ? <EspacoEquipeInbox accessToken={session.accessToken} /> : <EspacoEquipeForm members={collaborators} />}
      </main>
    </div>
  );
}
