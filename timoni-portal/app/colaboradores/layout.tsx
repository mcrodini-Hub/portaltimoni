import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import EspacoEquipeForm from "@/app/colaboradores/espaco-equipe-form";
import EspacoEquipeInbox from "@/app/colaboradores/espaco-equipe-inbox";
import PainelAlerts from "@/app/colaboradores/painel-alerts";
import PainelNotificationsClient from "@/app/painel-notifications-client";
import { TEAM_MEMBERS } from "@/lib/team-members";

const GESTAO_EMAILS = new Set(["mcrodini@gmail.com", "mrodini@gmail.com"]);

const navItems = [
  { href: "/dashboard", label: "Casa Timoni" },
  { href: "/colaboradores", label: "Painel Timoni" },
  { href: "/dashboard/estoque", label: "Estoque" },
  { href: "/dashboard/motorista", label: "Motorista" },
];

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
      <header className="sticky top-0 z-40 border-b border-blue-950/50 bg-[#0b1f5e] text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-2" aria-label="Menu colaboradores">
            {navItems.map((item) => (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 sm:text-base"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
            className="shrink-0"
          >
            <button
              type="submit"
              className="rounded-lg px-2 py-2 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <PainelNotificationsClient email={email} />

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        <PainelAlerts email={email} />
        {children}
        {isGestao ? <EspacoEquipeInbox /> : <EspacoEquipeForm members={TEAM_MEMBERS} />}
      </main>
    </div>
  );
}
