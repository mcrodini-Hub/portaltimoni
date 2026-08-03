import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { hasModuleAccess } from "@/lib/access-control";

export default async function ColaboradoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const email = session.user.email;
  const isPortalOwner = email === process.env.AUTHORIZED_EMAIL;
  const canAccessStock = hasModuleAccess(email, "estoque");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-blue-950/50 bg-[#0b1f5e] text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/colaboradores"
            className="shrink-0 py-3 text-base font-semibold tracking-tight text-white"
          >
            Painel Timoni
          </Link>

          <div className="flex items-center gap-2">
            {canAccessStock && (
              <Link
                href="/dashboard/estoque"
                className="shrink-0 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#0b1f5e] transition hover:bg-blue-50"
              >
                Estoque
              </Link>
            )}

            {isPortalOwner && (
              <Link
                href="/dashboard"
                className="shrink-0 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Portal Timoni
              </Link>
            )}

            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
              className="hidden shrink-0 sm:block"
            >
              <button
                type="submit"
                className="rounded-lg px-2 py-2 text-sm text-white/65 transition hover:bg-white/10 hover:text-white"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
        {children}
      </main>
    </div>
  );
}
