"use client";

import { useEffect, useState } from "react";
import type { UpdateModule } from "@/lib/module-updates";

type Arrival = { module: UpdateModule; count: number; summaries: string[] };

export default function ModuleArrivalSummary({ module }: { module: UpdateModule }) {
  const [arrival, setArrival] = useState<Arrival | null>(null);

  useEffect(() => {
    const key = `portal-module-arrival:${module}`;
    const showArrival = (value: Arrival) => {
      if (value.module !== module) return;
      window.sessionStorage.removeItem(key);
      setArrival(value);
    };
    const handleArrival = (event: Event) => showArrival((event as CustomEvent<Arrival>).detail);
    window.addEventListener("portal-module-arrival", handleArrival);
    const stored = window.sessionStorage.getItem(key);
    if (stored) {
      try {
        showArrival(JSON.parse(stored) as Arrival);
      } catch {
        window.sessionStorage.removeItem(key);
      }
    }
    return () => window.removeEventListener("portal-module-arrival", handleArrival);
  }, [module]);

  if (!arrival) return null;

  return (
    <section className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">O que há de novo</p>
          <p className="mt-1 text-sm font-semibold">
            Ao abrir o módulo, {arrival.count === 1 ? "esta atualização foi marcada" : "estas atualizações foram marcadas"} como vista{arrival.count === 1 ? "" : "s"}.
          </p>
          {arrival.summaries?.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {arrival.summaries.map((summary) => <li key={summary}>• {summary}</li>)}
            </ul>
          )}
        </div>
        <button type="button" onClick={() => setArrival(null)} className="rounded-lg px-2 py-1 text-sm font-semibold text-blue-800 hover:bg-blue-100" aria-label="Fechar resumo de novidades">
          Fechar
        </button>
      </div>
    </section>
  );
}
