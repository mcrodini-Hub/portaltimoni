import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import EspacoEquipeForm from "@/app/colaboradores/espaco-equipe-form";
import { TEAM_MEMBERS } from "@/lib/team-members";

export default async function ColaboradoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

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

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
            className="shrink-0"
          >
            <button
              type="submit"
              className="rounded-lg px-2 py-2 text-sm text-white/65 transition hover:bg-white/10 hover:text-white"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        {children}
        <EspacoEquipeForm members={TEAM_MEMBERS} />
      </main>
    </div>
  );
}
