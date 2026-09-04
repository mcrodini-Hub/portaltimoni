import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import PortalHeader from "@/components/portal-header";
import ConfiguracoesClient from "./configuracoes-client";
import { CICA_EMAIL } from "@/lib/portal-config";

const MANAGEMENT_EMAILS = new Set([CICA_EMAIL, "mrodini@gmail.com"]);

export default async function ConfiguracoesPage() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() || "";
  if (!MANAGEMENT_EMAILS.has(email)) redirect("/dashboard");
  return (
    <div className="min-h-screen bg-slate-50">
      <PortalHeader email={email} portalUser={session?.portalUser} />
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        <ConfiguracoesClient />
      </main>
    </div>
  );
}
