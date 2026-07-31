import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

const MOTORISTA_URL =
  "https://mcrodini-hub.github.io/portaltimoni/agenda-motorista/";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const comprasUrl = "https://trello.com/b/UfPrTr1H/compras";

  const linkClass =
    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white";

  const disabledClass =
    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-white/40";

  return (
    <div>
      <header className="sticky top-0 z-40 border-b border-blue-950/50 bg-[#0b1f5e] text-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="shrink-0 py-2 text-base font-semibold tracking-tight text-white"
          >
            Casa Timoni
          </Link>

          <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-2">
            <Link href="/dashboard" className={linkClass}>
              Início
            </Link>

            <Link href="/agenda" className={linkClass}>
              Agenda Ciça
            </Link>

            <a
              href={comprasUrl}
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              Compras
            </a>

            <Link href="/dashboard/estoque" className={linkClass}>
              Estoque
            </Link>

            <a
              href={MOTORISTA_URL}
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              Motorista
            </a>

            <span className={disabledClass}>Reuniões</span>
            <span className={disabledClass}>Marketing</span>
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
              className="rounded-lg px-2 py-1.5 text-sm text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        {children}
      </main>
    </div>
  );
}
