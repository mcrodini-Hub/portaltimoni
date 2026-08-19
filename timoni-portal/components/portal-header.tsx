import { signOut } from "@/lib/auth";
import { canManageMotorista, hasModuleAccess, type PortalModule } from "@/lib/access-control";
import Link from "next/link";
import PainelNotificationsClient from "@/app/painel-notifications-client";

const navItems: Array<{ href: string; label: string; module: PortalModule }> = [
  { href: "/colaboradores", label: "Painel Timoni", module: "painel" },
  { href: "/agenda", label: "Agenda Ciça", module: "agenda" },
  { href: "/dashboard/compras", label: "Compras", module: "compras" },
  { href: "/dashboard/conferencia-pedidos", label: "Conferência", module: "conferencia" },
  { href: "/dashboard/estoque", label: "Estoque", module: "estoque" },
  { href: "/dashboard/motorista-leitura", label: "Motorista", module: "motorista" },
  { href: "/dashboard/reunioes", label: "Reuniões", module: "reunioes" },
];

export default function PortalHeader({ email }: { email: string }) {
  const linkClass =
    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white";

  return (
    <header className="sticky top-0 z-40 border-b border-blue-950/50 bg-[#0b1f5e] text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/dashboard"
          className="shrink-0 py-3 text-base font-semibold tracking-tight text-white"
        >
          Casa Timoni
        </Link>

        <nav
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-2"
          aria-label="Menu principal"
        >
          {navItems.map(
            (item) =>
              hasModuleAccess(email, item.module) && (
                <Link
                  key={item.href}
                  href={item.module === "motorista" && canManageMotorista(email) ? "/dashboard/motorista" : item.href}
                  className={linkClass}
                >
                  {item.label}
                </Link>
              ),
          )}
        </nav>

        <PainelNotificationsClient email={email} />

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
  );
}
