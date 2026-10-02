import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasModuleAccess, isReadOnlyUser } from "@/lib/access-control";
import MotoristaAgenda from "./motorista-agenda";

export const metadata: Metadata = {
  title: "Agenda Motorista",
};

export default async function MotoristaPage() {
  const session = await auth();
  const email = session?.user?.email || "";
  if (!email || !hasModuleAccess(email, "motorista", session?.portalUser)) redirect("/dashboard");
  const readOnly = isReadOnlyUser(email, session?.portalUser);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">Casa Timoni</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Agenda do Motorista</h1>
        <p className="mt-1 text-sm text-slate-600">Entregas, retiradas e bloqueios de horário em uma agenda única.</p>
      </header>
      <div className="motorista-agenda-controle">
        <MotoristaAgenda readOnly={readOnly} />
      </div>
      <style>{`
        .motorista-agenda-controle button.bg-emerald-700,
        .motorista-agenda-controle button.bg-amber-600,
        .motorista-agenda-controle button.border-blue-200,
        .motorista-agenda-controle button.border-red-200 {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          color: #334155 !important;
        }
        .motorista-agenda-controle button.bg-emerald-700:hover,
        .motorista-agenda-controle button.bg-amber-600:hover,
        .motorista-agenda-controle button.border-blue-200:hover,
        .motorista-agenda-controle button.border-red-200:hover {
          background: #f8fafc !important;
        }

        @media (max-width: 1023px) {
          .motorista-agenda-controle .motorista-form .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 639px) {
          .motorista-agenda-controle .motorista-form {
            width: calc(100vw - 24px) !important;
            max-width: calc(100vw - 24px) !important;
            padding: 14px !important;
          }

          .motorista-agenda-controle .motorista-form .grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .motorista-agenda-controle .motorista-form input,
          .motorista-agenda-controle .motorista-form select,
          .motorista-agenda-controle .motorista-form textarea {
            width: 100% !important;
            min-width: 0 !important;
            font-size: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
