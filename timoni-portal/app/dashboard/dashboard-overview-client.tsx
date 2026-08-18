"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ModuleItem = { module: string; name: string; href: string; icon: string; accent: string };
type DashboardOverviewProps = { modules: ModuleItem[]; readOnly: boolean };
type ComprasResponse = { summary?: { pedidosParaFazer?: number; urgentes?: number } };
type NotificationsResponse = { items?: Array<{ type?: string }> };
type EventsResponse = { events?: unknown[] };
type EstoqueResponse = { pedidosEnviados?: Array<{ situacao?: string }> };
type MotoristaResponse = { ok?: boolean; viagens?: Array<{ notasJson?: string }> };

type Snapshot = {
  comprasPendentes: number | null;
  comprasUrgentes: number | null;
  novidades: number | null;
  estoquePendentes: number | null;
  estoqueACaminho: number | null;
  agendaProximos: number | null;
  motoristaHoje: number | null;
};

const emptySnapshot: Snapshot = {
  comprasPendentes: null,
  comprasUrgentes: null,
  novidades: null,
  estoquePendentes: null,
  estoqueACaminho: null,
  agendaProximos: null,
  motoristaHoje: null,
};

function metric(value: number | null) {
  return value === null ? "—" : String(value);
}

function localDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function endOfRange() {
  const end = new Date();
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  return end;
}

function finalizada(notasJson?: string) {
  try {
    const parsed = JSON.parse(String(notasJson || "[]"));
    return Boolean(parsed && !Array.isArray(parsed) && ["concluida", "retirado", "feito"].includes(parsed.status));
  } catch {
    return false;
  }
}

export default function DashboardOverviewClient({ modules, readOnly }: DashboardOverviewProps) {
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = endOfRange();
      const today = localDateString();

      const [comprasResult, notificationsResult, eventsResult, estoqueResult, motoristaResult] = await Promise.allSettled([
        fetch("/api/compras", { cache: "no-store" }).then(async (response) => {
          if (!response.ok) throw new Error("compras");
          return (await response.json()) as ComprasResponse;
        }),
        fetch("/api/painel-notifications", { cache: "no-store" }).then(async (response) => {
          if (!response.ok) throw new Error("notifications");
          return (await response.json()) as NotificationsResponse;
        }),
        fetch(`/api/events?timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}`, { cache: "no-store" }).then(async (response) => {
          if (!response.ok) throw new Error("events");
          return (await response.json()) as EventsResponse;
        }),
        fetch("/api/estoque", { cache: "no-store" }).then(async (response) => {
          if (!response.ok) throw new Error("estoque");
          return (await response.json()) as EstoqueResponse;
        }),
        fetch(`/api/motorista-leitura?action=dia&data=${today}`, { cache: "no-store" }).then(async (response) => {
          if (!response.ok) throw new Error("motorista");
          return (await response.json()) as MotoristaResponse;
        }),
      ]);

      if (cancelled) return;
      const next = { ...emptySnapshot };

      if (comprasResult.status === "fulfilled") {
        next.comprasPendentes = comprasResult.value.summary?.pedidosParaFazer ?? 0;
        next.comprasUrgentes = comprasResult.value.summary?.urgentes ?? 0;
      }
      if (notificationsResult.status === "fulfilled") {
        const items = notificationsResult.value.items ?? [];
        next.novidades = items.length;
        next.estoquePendentes = items.filter((item) => item.type === "estoque").length;
      }
      if (eventsResult.status === "fulfilled") {
        next.agendaProximos = (eventsResult.value.events ?? []).length;
      }
      if (estoqueResult.status === "fulfilled") {
        next.estoqueACaminho = (estoqueResult.value.pedidosEnviados ?? []).filter((item) => item.situacao === "enviado").length;
      }
      if (motoristaResult.status === "fulfilled") {
        next.motoristaHoje = (motoristaResult.value.viagens ?? []).filter((item) => !finalizada(item.notasJson)).length;
      }

      setSnapshot(next);
      setLoading(false);
    }

    void load();
    const interval = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const actionCount = useMemo(() => {
    const values = [snapshot.comprasPendentes, snapshot.estoquePendentes, snapshot.novidades];
    if (values.some((value) => value === null)) return null;
    return (snapshot.comprasPendentes ?? 0) + (snapshot.estoquePendentes ?? 0) + (snapshot.novidades ?? 0);
  }, [snapshot]);

  const moduleStatus = (module: string) => {
    if (module === "compras") return { value: metric(snapshot.comprasPendentes), label: snapshot.comprasUrgentes ? `${snapshot.comprasUrgentes} urgente${snapshot.comprasUrgentes === 1 ? "" : "s"}` : "pedidos pendentes", attention: (snapshot.comprasUrgentes ?? 0) > 0 };
    if (module === "estoque") return { value: metric(snapshot.estoqueACaminho), label: `${metric(snapshot.estoquePendentes)} solicitações · pedidos a caminho`, attention: (snapshot.estoquePendentes ?? 0) > 0 };
    if (module === "agenda") return { value: metric(snapshot.agendaProximos), label: "eventos nos próximos 7 dias", attention: false };
    if (module === "motorista") return { value: metric(snapshot.motoristaHoje), label: "viagens na agenda de hoje", attention: false };
    if (module === "painel") return { value: metric(snapshot.novidades), label: "novidades para consultar", attention: (snapshot.novidades ?? 0) > 0 };
    return null;
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ações abertas</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{loading ? "—" : metric(actionCount)}</p>
          <p className="mt-1 text-xs text-slate-500">Compras, estoque e novidades</p>
        </div>

        <Link href="/dashboard/compras" className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Compras</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="text-3xl font-bold tracking-tight text-slate-950">{metric(snapshot.comprasPendentes)}</p>
            {(snapshot.comprasUrgentes ?? 0) > 0 && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">{snapshot.comprasUrgentes} urgente{snapshot.comprasUrgentes === 1 ? "" : "s"}</span>}
          </div>
          <p className="mt-1 text-xs text-slate-600">pedidos para fazer</p>
        </Link>

        <Link href="/dashboard/estoque" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Pedidos a caminho</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{metric(snapshot.estoqueACaminho)}</p>
          <p className="mt-1 text-xs text-slate-600">no Estoque</p>
        </Link>

        <Link href="/motorista" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Motorista hoje</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{metric(snapshot.motoristaHoje)}</p>
          <p className="mt-1 text-xs text-slate-600">viagens programadas</p>
        </Link>

        <Link href="/agenda" className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Agenda Ciça</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{metric(snapshot.agendaProximos)}</p>
          <p className="mt-1 text-xs text-slate-600">eventos nos próximos 7 dias</p>
        </Link>

        <Link href="/colaboradores" className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Novidades</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{metric(snapshot.novidades)}</p>
          <p className="mt-1 text-xs text-slate-600">itens para consultar</p>
        </Link>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Módulos</h2>
          <p className="text-xs text-slate-500">Atualização automática a cada minuto</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((item) => {
            const status = moduleStatus(item.module);
            return (
              <Link key={item.name} href={item.href} className={`group rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.accent}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg shadow-sm">{item.icon}</span>
                  {status ? <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${status.attention ? "bg-red-100 text-red-700" : "bg-white text-slate-700"}`}>{status.value}</span> : <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600">{readOnly ? "Leitura" : "Acessar"}</span>}
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">{item.name}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{status?.label ?? "Abrir módulo"}</p>
                  </div>
                  <span className="text-sm font-bold text-slate-500 transition group-hover:translate-x-0.5">→</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
