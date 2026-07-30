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
 const comprasUrl =
  "https://script.google.com/macros/s/AKfycbze807SxqAJEkbYcNS1VYc-aZzWdAHatjk7fY3nbrV6hl5QsaXd9bJfKkAZaGPAxgFq4g/exec";

const estoqueUrl =
  "https://script.google.com/macros/s/AKfycbyDkQIwe3cb6JYVj-9jjt-pHLQa7e9XK0k8IHGGjhONuTC_8AM8M-L_4Dacb9Ji5wD3Yg/exec";

  const linkClass =
    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900";

  const disabledClass =
    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-slate-400";

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 font-semibold text-slate-900"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 font-black text-white">
              T
            </span>
            <span>Portal Timoni</span>
          </Link>

          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="hidden sm:inline">{session.user.email}</span>

            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-lg px-2 py-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Sair"
              >
                Sair
              </button>
            </form>
          </div>
        </div>

        <nav className="border-t border-slate-100">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            <Link href="/dashboard" className={linkClass}>
              Início
            </Link>

            <Link href="/agenda" className={linkClass}>
              Agenda Ciça
            </Link>

            {comprasUrl ? (
              <a
                href={comprasUrl}
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                Compras
              </a>
            ) : (
              <span className={disabledClass}>Compras</span>
            )}

            {estoqueUrl ? (
              <a
                href={estoqueUrl}
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                Estoque
              </a>
            ) : (
              <span className={disabledClass}>Estoque</span>
            )}

            <a
              href={MOTORISTA_URL}
              target="_blank"
              rel="noreferrer"
              className={linkClass}
            >
              Motorista
            </a>

            <span className={disabledClass}>Reuniões — em breve</span>

            <span className={disabledClass}>Marketing — em breve</span>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
