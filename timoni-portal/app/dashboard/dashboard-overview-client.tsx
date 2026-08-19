"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ModuleItem = { module: string; name: string; href: string; icon: string; accent: string };
type DashboardOverviewProps = { modules: ModuleItem[]; motoristaControle: boolean };
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

export default function DashboardOverviewClient({ modules, motoristaControle }: DashboardOverviewProps) {
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const allowedModules = useMemo(() => new Set(modules.map((item) => item.module)), [modules]);
  const secondaryModules = useMemo(
    () => modules.filter((item) => item.module === "conferencia" || item.module === "reunioes"),
    [modules],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = endOfRange();
      const today = localDateString();

      const comprasPromise = allowedModules.has("compras")
        ? fetch("/api/compras", { cache: "no-store" }).then(async (response) => {
            if (!response.ok) throw new Error("compras");
            return (await response.json()) as ComprasResponse;
          })
        : Promise.resolve(null);
      const notificationsPromise = allowedModules.has("painel")
        ? fetch("/api/painel-notifications", { cache: "no-store" }).then(async (response) => {
            if (!response.ok) throw new Error("notifications");
            return (await response.json()) as NotificationsResponse;
          })
        : Promise.resolve(null);
      const eventsPromise = allowedModules.has("agenda")
        ? fetch(`/api/events?timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}`, { cache: "no-store" }).then(async (response) => {
            if (!response.ok) throw new Error("events");
            return (await response.json()) as EventsResponse;
          })
        : Promise.resolve(null);
      const estoquePromise = allowedModules.has("estoque")
        ? fetch("/api/estoque", { cache: "no-store" }).then(async (response) => {
            if (!response.ok) throw new Error("estoque");
            return (await response.json()) as EstoqueResponse;
          })
        : Promise.resolve(null);
      const motoristaPromise = allowedModules.has("motorista")
        ? fetch(`/api/motorista-leitura?action=dia&data=${today}`, { cache: "no-store" }).then(async (response) => {
            if (!response.ok) throw new Error("motorista");
            return (await response.json()) as MotoristaResponse;
          })
        : Promise.resolve(null);

      const [comprasResult, notificationsResult, eventsResult, estoqueResult, motoristaResult] =
        await Promise.allSettled([comprasPromise, notificationsPromise, eventsPromise, estoquePromise, motoristaPromise]);

      if (cancelled) return;
      const next = { ...emptySnapshot };

      if (comprasResult.status === "fulfilled" && comprasResult.value) {
        next.comprasPendentes = comprasResult.value.summary?.pedidosParaFazer ?? 0;
        next.comprasUrgentes = comprasResult.value.summary?.urgentes ?? 0;
      }
      if (notificationsResult.status === "fulfilled" && notificationsResult.value) {
        const items = notificationsResult.value.items ?? [];
        next.novidades = items.length;
        next.estoquePendentes = items.filter((item) => item.type === "estoque").length;
      }
      if (eventsResult.status === "fulfilled" && eventsResult.value) {
        next.agendaProximos = (eventsResult.value.events ?? []).length;
      }
      if (estoqueResult.status === "fulfilled" && estoqueResult.value) {
        next.estoqueACaminho = (estoqueResult.value.pedidosEnviados ?? []).filter((item) => item.situacao === "enviado").length;
      }
      if (motoristaResult.status === "fulfilled" && motoristaResult.value) {
        next.motoristaHoje = (motoristaResult.value.viagens ?? []).length;
      }

      setSnapshot(next);
    }

    void load();
    const interval = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [allowedModules]);

  return (
    <div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {allowedModules.has("compras") && (
          <Link href="/dashboard/compras" className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Compras</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-3xl font-bold tracking-tight text-slate-950">{metric(snapshot.comprasPendentes)}</p>
              {(snapshot.comprasUrgentes ?? 0) > 0 && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">{snapshot.comprasUrgentes} urgente{snapshot.comprasUrgentes === 1 ? "" : "s"}</span>}
            </div>
            <p className="mt-1 text-xs text-slate-600">pedidos para fazer</p>
          </Link>
        )}

        {allowedModules.has("estoque") && (
          <Link href="/dashboard/estoque" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Estoque</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{metric(snapshot.estoqueACaminho)}</p>
            <p className="mt-1 text-xs text-slate-600">pedidos a caminho · {metric(snapshot.estoquePendentes)} solicitações</p>
          </Link>
        )}

        {allowedModules.has("motorista") && (
          <Link href={motoristaControle ? "/dashboard/motorista" : "/dashboard/motorista-leitura"} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Visualização Motorista</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{metric(snapshot.motoristaHoje)}</p>
            <p className="mt-1 text-xs text-slate-600">agendamentos hoje</p>
          </Link>
        )}

        {allowedModules.has("agenda") && (
          <Link href="/agenda" className="rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Agenda Ciça</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{metric(snapshot.agendaProximos)}</p>
            <p className="mt-1 text-xs text-slate-600">eventos nos próximos 7 dias</p>
          </Link>
        )}

        {allowedModules.has("painel") && (
          <Link href="/colaboradores" className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Novidades</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{metric(snapshot.novidades)}</p>
            <p className="mt-1 text-xs text-slate-600">itens para consultar</p>
          </Link>
        )}
      </section>

      {secondaryModules.length > 0 && (
        <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {secondaryModules.map((item) => (
            <Link
              key={item.module}
              href={item.href}
              className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${item.accent}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">{item.name}</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">Abrir</p>
              <p className="mt-1 text-xs text-slate-600">acesso direto ao módulo</p>
            </Link>
          ))}
        </section>
      )}

      <p className="mt-3 text-right text-xs text-slate-500">Atualização automática a cada minuto</p>
    </div>
  );
}
