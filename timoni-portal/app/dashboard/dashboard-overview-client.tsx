"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UpdateModule } from "@/lib/module-updates";
import { useModuleUpdates } from "@/components/module-updates-store";

type ModuleItem = { module: string; name: string; href: string; icon: string; accent: string };
type Props = { modules: ModuleItem[]; motoristaControle: boolean; espacoEquipeControle: boolean; isManagement: boolean; isCica: boolean };
type Snapshot = { compras: number | null; estoqueRotativo: number | null; solicitacoes: number | null; agenda: number | null; motorista: number | null; equipe: number | null; leads: number | null };

const empty: Snapshot = { compras: null, estoqueRotativo: null, solicitacoes: null, agenda: null, motorista: null, equipe: null, leads: null };
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function DashboardOverviewClient({ modules, motoristaControle, espacoEquipeControle, isManagement }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const { updates, reload: reloadUpdates, markRead: markModuleRead } = useModuleUpdates(isManagement);
  const allowed = useMemo(() => new Set(modules.map((item) => item.module)), [modules]);

  const markRead = useCallback(async (module?: UpdateModule) => {
    if (!module || !updates[module]) return;
    try {
      await markModuleRead(module);
    } catch {
      void reloadUpdates();
    }
  }, [markModuleRead, reloadUpdates, updates]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const params = new URLSearchParams({
        modules: Array.from(allowed).join(","),
        equipe: espacoEquipeControle ? "1" : "0",
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        today: localDate(),
      });
      try {
        const response = await fetch(`/api/painel-resumo?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data?.summary) setSnapshot({ ...empty, ...data.summary });
      } catch {
        // O Painel continua navegável mesmo se um resumo temporariamente falhar.
      }
    }
    const refreshWhenVisible = () => {
      if (!document.hidden) void load();
    };
    refreshWhenVisible();
    const interval = window.setInterval(refreshWhenVisible, 120_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [allowed, espacoEquipeControle]);

  const desktopCards = [
    ...(allowed.has("agenda") ? [["Agenda", "/agenda", "📅", snapshot.agenda] as const] : []),
    ...(allowed.has("compras") ? [["Compras", "/dashboard/compras", "🛒", snapshot.compras] as const] : []),
    ...(allowed.has("estoque") ? [["Estoque", "/dashboard/estoque", "📦", snapshot.solicitacoes] as const] : []),
    ...(allowed.has("estoque-rotativo") ? [["Estoque Rotativo", "/dashboard/estoque-rotativo", "🔄", snapshot.estoqueRotativo] as const] : []),
    ...(allowed.has("leads") ? [["Leads", "/dashboard/leads", "🎯", snapshot.leads] as const] : []),
    ...(allowed.has("motorista") ? [["Motorista", "/dashboard/motorista", "🚚", snapshot.motorista] as const] : []),
  ];

  const mobileCards = [
    ...desktopCards,
    ...(espacoEquipeControle ? [["Equipe", "/espaco-equipe", "👥", snapshot.equipe] as const] : []),
  ];

  const renderCards = (cards: typeof mobileCards, mobile = false) => cards.map(([name, href, _icon, count]) => {
    const updateModule = ({ Compras: "compras", Leads: "leads", Estoque: "estoque", "Estoque Rotativo": "estoque-rotativo" } as const)[name as "Compras" | "Leads" | "Estoque" | "Estoque Rotativo"];
    const pending = updateModule ? updates[updateModule] : undefined;
    return <Link key={name} href={href} onClick={() => void markRead(updateModule)} className={mobile
      ? "relative flex min-h-16 min-w-0 flex-col justify-between rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 shadow-sm transition active:bg-blue-100"
      : "relative flex min-h-36 min-w-0 flex-col justify-between rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"}>
      {pending ? (
        <div className="flex justify-end">
          <span aria-label={`${pending.count} atualizações em ${name}`} className="min-w-6 rounded-full bg-red-500 px-1.5 text-center text-xs font-bold leading-6 text-white">
            {pending.count > 99 ? "99+" : pending.count}
          </span>
        </div>
      ) : null}
      <div className={mobile ? "mt-1" : "mt-4"}>
        <p className={mobile ? "truncate text-[12px] font-normal leading-4 text-slate-900" : "truncate text-lg font-semibold text-slate-950"}>{name}</p>
        {count !== null ? <p className={mobile ? "mt-1 text-xl font-bold leading-none text-[#0b1f5e]" : "mt-2 text-3xl font-bold leading-none text-[#0b1f5e]"}>{count}</p> : null}
      </div>
    </Link>;
  });

  return <>
    <section className="grid grid-cols-2 gap-2 sm:hidden" aria-label="Atalhos do Painel">
      {renderCards(mobileCards, true)}
    </section>
    <section className="hidden gap-4 sm:grid lg:grid-cols-3" aria-label="Atalhos do Painel">
      {renderCards(desktopCards)}
    </section>
  </>;
}
