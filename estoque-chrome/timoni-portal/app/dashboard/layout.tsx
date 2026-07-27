import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div>
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 font-black text-white">T</span>
              <span>Portal Timoni</span>
            </Link>
            <nav className="hidden items-center gap-1 text-sm sm:flex">
              <Link href="/dashboard" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900">Início</Link>
              <Link href="/agenda" className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900">Agenda</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="hidden sm:inline">{session.user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button type="submit" className="rounded-lg px-2 py-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Sair">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
