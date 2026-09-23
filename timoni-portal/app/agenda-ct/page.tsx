import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agenda CT",
};

const AGENDA_CT_EMBED =
  "https://calendar.google.com/calendar/embed?src=28fddf65c061d4f277f8ee4ddee48d5118d71dadf3e45de3443a3fd898b79356%40group.calendar.google.com&ctz=America%2FSao_Paulo";

export default function AgendaCTPage() {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:rounded-2xl sm:p-4">
        <div className="mb-3 px-1">
          <h1 className="text-xl font-semibold text-slate-950 sm:text-2xl">Agenda CT</h1>
          <p className="mt-1 text-sm text-slate-600">
            Calendário compartilhado da Casa Timoni. O acesso aos eventos continua respeitando as permissões do Google Calendar.
          </p>
        </div>
        <div className="h-[72vh] min-h-[560px] w-full overflow-hidden rounded-xl border border-slate-200">
          <iframe
            title="Agenda CT"
            src={AGENDA_CT_EMBED}
            className="h-full w-full border-0"
            loading="lazy"
          />
        </div>
      </section>
    </div>
  );
}
