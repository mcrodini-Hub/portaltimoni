import { signIn } from "@/lib/auth";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "Essa conta Google não tem acesso ao Portal Timoni.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "Não foi possível entrar." : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Portal Timoni — Agenda</h1>
        <p className="mt-2 text-sm text-slate-500">
          Entre com a conta Google autorizada para ver e gerenciar sua agenda.
        </p>

        {errorMessage && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Entrar com Google
          </button>
        </form>
      </div>
    </main>
  );
}
