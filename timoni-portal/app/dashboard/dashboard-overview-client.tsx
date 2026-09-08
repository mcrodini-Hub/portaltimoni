"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PortalIcon, { type PortalIconName } from "@/components/portal-icon";
import type { UpdateModule } from "@/lib/module-updates";

type ModuleItem = { module: string; name: string; href: string; icon: string; accent: string };
type Props = { modules: ModuleItem[]; motoristaControle: boolean; espacoEquipeControle: boolean; isManagement: boolean; isCica: boolean };
type NotificationItem = { type?: string };
type StockOrder = { situacao?: string };
type MeetingItem = { status?: string; date?: string; secondDate?: string };
type CalendarEvent = { id: string; summary: string; start: string; location?: string; completed?: boolean; allDay?: boolean };
type Snapshot = { compras: number | null; estoque: number | null; solicitacoes: number | null; agenda: number | null; motorista: number | null; equipe: number | null; leads: number | null; reunioes: number | null; events: CalendarEvent[] };
type PendingUpdate = { module: UpdateModule; count: number; latestAt: string };
type Card = { key: string; name: string; href: string; icon: PortalIconName; iconColor: string; background: string; updateModule?: UpdateModule };

const empty: Snapshot = { compras: null, estoque: null, solicitacoes: null, agenda: null, motorista: null, equipe: null, leads: null, reunioes: null, events: [] };
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function DashboardOverviewClient({ modules, motoristaControle, espacoEquipeControle, isManagement, isCica }: Props) {
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

  const cards = useMemo(() => {
    const list: Card[] = [];
    if (allowed.has("agenda")) list.push({ key: "agenda", name: "Agenda", href: "/agenda", icon: "calendar", iconColor: "text-green-700", background: "bg-emerald-50", updateModule: "agenda" });
    if (allowed.has("reunioes")) list.push({ key: "reunioes", name: "Reuniões", href: "/dashboard/reunioes", icon: "meetings", iconColor: "text-indigo-800", background: "bg-violet-50", updateModule: "reunioes" });
    if (allowed.has("motorista")) list.push({ key: "motorista", name: "Motorista", href: motoristaControle ? "/dashboard/motorista" : "/dashboard/motorista-leitura", icon: "truck", iconColor: "text-blue-600", background: "bg-blue-50", updateModule: "motorista" });
    if (allowed.has("compras")) list.push({ key: "compras", name: "Compras", href: "/dashboard/compras", icon: "cart", iconColor: "text-orange-700", background: "bg-orange-50", updateModule: "compras" });
    if (allowed.has("estoque")) list.push({ key: "estoque", name: "Estoque", href: "/dashboard/estoque", icon: "stock", iconColor: "text-amber-700", background: "bg-amber-50", updateModule: "estoque" });
    if (allowed.has("conferencia")) list.push({ key: "conferencia", name: "Conferência", href: "/dashboard/conferencia-pedidos", icon: "document", iconColor: "text-rose-700", background: "bg-rose-50", updateModule: "conferencia" });
    if (allowed.has("leads")) list.push({ key: "leads", name: "Leads", href: "/dashboard/leads", icon: "leads", iconColor: "text-cyan-800", background: "bg-teal-50", updateModule: "leads" });
    if (allowed.has("painel")) {
      list.push({ key: "equipe", name: "Espaço Equipe", href: "/espaco-equipe", icon: "team", iconColor: "text-indigo-800", background: "bg-violet-50", updateModule: "espaco-equipe" });
      list.push({ key: "avisos", name: "Avisos", href: "/colaboradores", icon: "notice", iconColor: "text-rose-700", background: "bg-rose-50", updateModule: "avisos" });
    }
    if (isCica && allowed.has("agenda")) list.push({ key: "agenda-cica", name: "Agenda Ciça", href: "/agenda", icon: "star", iconColor: "text-cyan-700", background: "bg-cyan-50", updateModule: "agenda" });
    if (isManagement) list.push({ key: "configuracoes", name: "Configurações", href: "/configuracoes", icon: "settings", iconColor: "text-slate-800", background: "bg-slate-100" });
    return list;
  }, [allowed, isCica, isManagement, motoristaControle]);

  const desktopCards = [
    ...(allowed.has("agenda") ? [["Agenda", "/agenda", "📅", snapshot.agenda] as const] : []),
    ...(allowed.has("motorista") ? [["Motorista", motoristaControle ? "/dashboard/motorista" : "/dashboard/motorista-leitura", "🚚", snapshot.motorista] as const] : []),
    ...(allowed.has("compras") ? [["Compras", "/dashboard/compras", "🛒", snapshot.compras] as const] : []),
    ...(allowed.has("leads") ? [["Leads", "/dashboard/leads", "🎯", snapshot.leads] as const] : []),
    ...(allowed.has("estoque") ? [["Estoque", "/dashboard/estoque", "📦", snapshot.solicitacoes] as const] : []),
  ];

  return <>
    <section className="grid grid-cols-2 gap-2.5 min-[390px]:grid-cols-3 sm:hidden" aria-label="Módulos do Portal">
      {cards.map((card) => {
        const pending = card.updateModule ? updates[card.updateModule] : undefined;
        return <Link key={card.key} href={card.href} onClick={() => void markRead(card.updateModule)} className={`relative flex min-h-[7.1rem] min-w-0 flex-col justify-between rounded-2xl border border-white/80 p-3 shadow-sm transition active:scale-[.98] ${card.background}`}>
        <div className="flex items-start justify-between gap-1">
          <PortalIcon name={card.icon} className={`h-8 w-8 ${card.iconColor}`} />
          {pending ? <span className="min-w-6 rounded-full bg-red-500 px-1.5 text-center text-[.67rem] font-bold leading-6 text-white shadow-sm">{pending.count > 99 ? "99+" : pending.count}</span> : null}
        </div>
        <div className="flex items-end justify-between gap-1">
          <span className="break-words text-[.82rem] font-semibold leading-tight text-slate-950 sm:text-base">{card.name}</span>
          <span className={`text-2xl font-light leading-none ${card.iconColor}`} aria-hidden="true">›</span>
        </div>
      </Link>;
      })}
    </section>

    <section className="hidden grid-cols-2 gap-4 sm:grid lg:grid-cols-3" aria-label="Atalhos do Painel">
      {desktopCards.map(([name, href, icon, count]) => <Link key={name} href={href} className="relative flex min-h-36 min-w-0 flex-col justify-between rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center justify-between"><span className="text-2xl text-blue-700">{icon}</span><span className="text-xl text-blue-700">›</span></div>
        <div className="mt-4"><p className="truncate text-lg font-semibold text-slate-950">{name}</p>{count !== null ? <p className="mt-2 text-3xl font-bold leading-none text-[#0b1f5e]">{count}</p> : null}</div>
      </Link>)}
    </section>

    {allowed.has("agenda") ? <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:hidden">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[.92rem] font-semibold text-slate-950 sm:text-lg"><PortalIcon name="calendar" className="h-5 w-5 text-blue-600"/>Compromissos de hoje</h2>
        <Link href="/agenda" className="text-[.78rem] font-medium text-blue-700 sm:text-sm">Ver todos</Link>
      </div>
      {snapshot.events.length ? <div className="divide-y divide-slate-200">{snapshot.events.slice(0, 3).map((event) => {
        const date = new Date(event.start);
        const time = event.allDay ? "Dia todo" : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
        return <Link key={event.id} href="/agenda" className="grid grid-cols-[4.4rem_1fr] gap-3 py-2.5 first:pt-0 last:pb-0">
          <time className="border-r border-slate-200 pr-3 text-[.82rem] font-medium text-slate-900">{time}</time>
          <span className="min-w-0"><strong className="block truncate text-[.82rem] font-medium text-slate-900">{event.summary}</strong>{event.location ? <span className="block truncate text-[.72rem] text-slate-500">{event.location}</span> : null}</span>
        </Link>;
      })}</div> : <p className="py-2 text-center text-[.8rem] text-slate-500">Nenhum compromisso para hoje.</p>}
    </section> : null}

    <aside className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-3.5 text-blue-950 sm:hidden">
      <PortalIcon name="lightbulb" className="mt-0.5 h-6 w-6 shrink-0 text-blue-700" />
      <p className="text-[.75rem] leading-relaxed"><strong>Dica:</strong> todos os módulos estão disponíveis aqui no painel, sem precisar usar o menu superior.</p>
    </aside>
  </>;
}
