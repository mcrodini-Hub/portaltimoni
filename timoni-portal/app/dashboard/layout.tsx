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
  const estoqueUrl =
    "https://docs.google.com/spreadsheets/d/1cESMTRx98e6AbY5vxPCcT7VrqYAbgH0xGUk87ybqHUo/edit";

  const linkClass =
    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950";
  const disabledClass =
    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-400";

  return (
    <div>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="shrink-0 py-2 text-base font-semibold tracking-tight text-slate-950"
          >
            Casa Timoni
          </Link>

          <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-2">
            <Link href="/dashboard" className={linkClass}>Início</Link>
            <Link href="/agenda" className={linkClass}>Agenda Ciça</Link>
            <a href={comprasUrl} target="_blank" rel="noreferrer" className={linkClass}>Compras</a>
            <a href={estoqueUrl} target="_blank" rel="noreferrer" className={linkClass}>Estoque</a>
            <a href={MOTORISTA_URL} target="_blank" rel="noreferrer" className={linkClass}>Motorista</a>
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
              className="rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
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
