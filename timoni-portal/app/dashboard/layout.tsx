import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div>
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold">Portal Timoni</Link>
          <nav className="hidden items-center gap-4 text-sm text-slate-500 sm:flex">
            <Link href="/dashboard" className="hover:text-slate-900">Início</Link>
            <Link href="/agenda" className="hover:text-slate-900">Agenda</Link>
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
            <button type="submit" className="text-slate-400 hover:text-slate-700" aria-label="Sair">
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
