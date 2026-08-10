import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { hasModuleAccess } from "@/lib/access-control";
import StoreSwitcher from "./store-switcher";
import PainelNotificationsClient from "@/app/painel-notifications-client";

const MOTORISTA_URL = "/dashboard/motorista";
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

  const email = session.user.email;
  const showStoreSwitcher = STORE_SWITCHER_EMAILS.has(email.toLowerCase());
  const linkClass =
    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-blue-950/50 bg-[#0b1f5e] text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="shrink-0 py-3 text-base font-semibold tracking-tight text-white"
          >
            Casa Timoni
          </Link>

          <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-2">
            {hasModuleAccess(email, "painel") && (
              <Link href="/colaboradores" className={linkClass}>Painel Timoni</Link>
            )}
            {hasModuleAccess(email, "agenda") && (
              <Link href="/agenda" className={linkClass}>Agenda Ciça</Link>
            )}
            {hasModuleAccess(email, "compras") && (
              <Link href="/dashboard/compras" className={linkClass}>Compras</Link>
            )}
            {hasModuleAccess(email, "conferencia") && (
              <Link href="/dashboard/conferencia-pedidos" className={linkClass}>Conferência</Link>
            )}
            {hasModuleAccess(email, "estoque") && (
              <Link href="/dashboard/estoque" className={linkClass}>Estoque</Link>
            )}
            {hasModuleAccess(email, "financeiro") && (
              <Link href="/dashboard/financeiro" className={linkClass}>Financeiro</Link>
            )}
            {hasModuleAccess(email, "marketing") && (
              <Link href="/dashboard/marketing" className={linkClass}>Marketing</Link>
            )}
            {hasModuleAccess(email, "motorista") && (
              <Link href={MOTORISTA_URL} className={linkClass}>Motorista</Link>
            )}
            {hasModuleAccess(email, "reunioes") && (
              <Link href="/dashboard/reunioes" className={linkClass}>Reuniões</Link>
            )}
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
              className="rounded-lg px-3 py-2 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <PainelNotificationsClient email={email} />

      {showStoreSwitcher && <StoreSwitcher />}

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        {children}
      </main>
    </div>
  );
}
