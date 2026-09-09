"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UpdateModule } from "@/lib/module-updates";

type ModuleItem = { module: string; name: string; href: string; icon: string; accent: string };
type Props = { modules: ModuleItem[]; motoristaControle: boolean; espacoEquipeControle: boolean; isManagement: boolean; isCica: boolean };
type NotificationItem = { type?: string };
type StockOrder = { situacao?: string };
type MeetingItem = { status?: string; date?: string; secondDate?: string };
type CalendarEvent = { id: string; summary: string; start: string; location?: string; completed?: boolean; allDay?: boolean };
type Snapshot = { compras: number | null; estoque: number | null; solicitacoes: number | null; agenda: number | null; motorista: number | null; equipe: number | null; leads: number | null; reunioes: number | null; events: CalendarEvent[] };
type PendingUpdate = { module: UpdateModule; count: number; latestAt: string };


const empty: Snapshot = { compras: null, estoque: null, solicitacoes: null, agenda: null, motorista: null, equipe: null, leads: null, reunioes: null, events: [] };
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function DashboardOverviewClient({ modules, motoristaControle, espacoEquipeControle, isManagement }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [updates, setUpdates] = useState<Record<string, PendingUpdate>>({});
  const allowed = useMemo(() => new Set(modules.map((item) => item.module)), [modules]);

  const loadUpdates = useCallback(async () => {
    if (!isManagement) return;
    try {
      const response = await fetch("/api/module-updates", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) return;
      const next: Record<string, PendingUpdate> = {};
      for (const item of data.updates || []) next[item.module] = item;
      setUpdates(next);
    } catch {
      // Falhas temporárias não devem impedir o uso dos módulos.
    }
  }, [isManagement]);

  useEffect(() => {
    void loadUpdates();
    const interval = window.setInterval(loadUpdates, 10_000);
    return () => window.clearInterval(interval);
  }, [loadUpdates]);

  const markRead = useCallback(async (module?: UpdateModule) => {
    if (!module || !updates[module]) return;
    const pending = updates[module];
    setUpdates((current) => {
      const next = { ...current };
      delete next[module];
      return next;
    });
    try {
      const response = await fetch("/api/module-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, through: pending.latestAt }),
        keepalive: true,
      });
      if (!response.ok) throw new Error("Falha ao confirmar leitura.");
    } catch {
      void loadUpdates();
    }
  }, [loadUpdates, updates]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      const today = localDate();
      const requests = [
        allowed.has("compras") ? fetch("/api/compras", { cache: "no-store" }).then((r) => r.ok ? r.json() : Promise.reject()) : null,
        allowed.has("painel") ? fetch("/api/painel-notifications", { cache: "no-store" }).then((r) => r.ok ? r.json() : Promise.reject()) : null,
        allowed.has("agenda") ? fetch(`/api/events?timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : Promise.reject()) : null,
        allowed.has("estoque") ? fetch("/api/estoque", { cache: "no-store" }).then((r) => r.ok ? r.json() : Promise.reject()) : null,
        allowed.has("motorista") ? fetch(`/api/motorista-leitura?action=dia&data=${today}`, { cache: "no-store" }).then((r) => r.ok ? r.json() : Promise.reject()) : null,
        espacoEquipeControle ? fetch("/api/espaco-equipe", { cache: "no-store" }).then((r) => r.ok ? r.json() : Promise.reject()) : null,
        allowed.has("leads") ? fetch("/api/leads", { cache: "no-store" }).then((r) => r.ok ? r.json() : Promise.reject()) : null,
        allowed.has("reunioes") ? fetch("/api/reunioes", { cache: "no-store" }).then((r) => r.ok ? r.json() : Promise.reject()) : null,
      ];
      const results = await Promise.allSettled(requests);
      if (cancelled) return;
      const next = { ...empty };
      if (results[0].status === "fulfilled" && results[0].value) next.compras = results[0].value.summary?.pedidosParaFazer ?? 0;
      if (results[1].status === "fulfilled" && results[1].value) next.solicitacoes = (results[1].value.items ?? []).filter((item: NotificationItem) => item.type === "estoque").length;
      if (results[2].status === "fulfilled" && results[2].value) {
        next.events = (results[2].value.events ?? []).filter((event: CalendarEvent) => !event.completed);
        next.agenda = next.events.length;
      }
      if (results[3].status === "fulfilled" && results[3].value) next.estoque = (results[3].value.pedidosEnviados ?? []).filter((item: StockOrder) => item.situacao === "enviado").length;
      if (results[4].status === "fulfilled" && results[4].value) next.motorista = (results[4].value.viagens ?? []).length;
      if (results[5].status === "fulfilled" && results[5].value) next.equipe = results[5].value.pending ?? 0;
      if (results[6].status === "fulfilled" && results[6].value) next.leads = results[6].value.summary?.pendentes ?? 0;
      if (results[7].status === "fulfilled" && results[7].value) {
        next.reunioes = (results[7].value.items ?? []).filter((item: MeetingItem) => item.status !== "concluida").reduce((total: number, item: MeetingItem) => total + (item.date && item.date >= today ? 1 : 0) + (item.secondDate && item.secondDate >= today ? 1 : 0), 0);
      }
      setSnapshot(next);
    }
    void load();
    const interval = window.setInterval(load, 60_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [allowed, espacoEquipeControle]);

  const desktopCards = [
    ...(allowed.has("agenda") ? [["Agenda", "/agenda", "📅", snapshot.agenda] as const] : []),
    ...(allowed.has("compras") ? [["Compras", "/dashboard/compras", "🛒", snapshot.compras] as const] : []),
    ...(allowed.has("estoque") ? [["Estoque", "/dashboard/estoque", "📦", snapshot.solicitacoes] as const] : []),
    ...(allowed.has("leads") ? [["Leads", "/dashboard/leads", "🎯", snapshot.leads] as const] : []),
    ...(allowed.has("motorista") ? [["Motorista", motoristaControle ? "/dashboard/motorista" : "/dashboard/motorista-leitura", "🚚", snapshot.motorista] as const] : []),
  ];

  const mobileCards = [
    ...desktopCards,
    ...(espacoEquipeControle ? [["Espaço Equipe", "/espaco-equipe", "👥", snapshot.equipe] as const] : []),
  ];

  const renderCards = (cards: typeof mobileCards) => cards.map(([name, href, icon, count]) => {
    const updateModule = ({ Compras: "compras", Leads: "leads", Estoque: "estoque" } as const)[name as "Compras" | "Leads" | "Estoque"];
    const pending = updateModule ? updates[updateModule] : undefined;
    return <Link key={name} href={href} onClick={() => void markRead(updateModule)} className="relative flex min-h-32 sm:min-h-36 min-w-0 flex-col justify-between rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between"><span className="text-2xl text-blue-700">{icon}</span><span className="flex items-center gap-2">{pending ? <span aria-label={`${pending.count} atualizações em ${name}`} className="min-w-6 rounded-full bg-red-500 px-1.5 text-center text-xs font-semibold leading-6 text-white">{pending.count > 99 ? "99+" : pending.count}</span> : null}<span className="text-xl text-blue-700">›</span></span></div>
      <div className="mt-4"><p className="truncate text-lg font-semibold text-slate-950">{name}</p>{count !== null ? <p className="mt-2 text-3xl font-bold leading-none text-[#0b1f5e]">{count}</p> : null}</div>
    </Link>;
  });

  return <>
    <section className="grid grid-cols-2 gap-3 sm:hidden" aria-label="Atalhos do Painel">
      {renderCards(mobileCards)}
    </section>
    <section className="hidden gap-4 sm:grid lg:grid-cols-3" aria-label="Atalhos do Painel">
      {renderCards(desktopCards)}
    </section>

  </>;
}
