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

  const todayLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  const linkClass =
    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950";

  const disabledClass =
    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-400";

  return (
    <div>
      <header className="sticky top-0 z-40 bg-white/95 shadow-sm backdrop-blur">
        <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-blue-700 text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src="/casa-timoni-logo.svg"
                alt="Casa Timoni"
                className="h-11 w-auto rounded-lg bg-[#f7efe3] px-2 py-1"
              />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold sm:text-lg">Olá, Ciça.</p>
                <p className="truncate text-xs text-blue-100/90 sm:text-sm">
                  Central de gestão
                </p>
              </div>
            </div>

            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-100">
                Hoje
              </p>
              <p className="mt-0.5 capitalize text-xs font-semibold text-white sm:text-sm">
                {todayLabel}
              </p>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
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
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        {children}
      </main>
    </div>
  );
}
