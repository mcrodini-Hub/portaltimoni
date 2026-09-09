"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PortalIcon, { type PortalIconName } from "@/components/portal-icon";
import type { UpdateModule } from "@/lib/module-updates";

type MobileNavItem = { href: string; label: string; updateModule?: UpdateModule; icon: PortalIconName; color: string };
type PendingUpdate = { module: UpdateModule; count: number; latestAt: string };

export default function MobilePortalHeader({ items, showUpdates, showGuide, initials }: { items: MobileNavItem[]; showUpdates: boolean; showGuide: boolean; initials: string }) {
  const [open, setOpen] = useState(false);
  const [updates, setUpdates] = useState<Record<string, PendingUpdate>>({});

  const load = useCallback(async () => {
    if (!showUpdates) return;
    try {
      const response = await fetch("/api/module-updates", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) return;
      const next: Record<string, PendingUpdate> = {};
      for (const item of data.updates || []) next[item.module] = item;
      setUpdates(next);
    } catch {
      // A navegação permanece disponível mesmo se a atualização falhar.
    }
  }, [showUpdates]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 10_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const total = useMemo(() => Object.values(updates).reduce((sum, item) => sum + item.count, 0), [updates]);

  async function openItem(item: MobileNavItem) {
    setOpen(false);
    const pending = item.updateModule ? updates[item.updateModule] : undefined;
    if (!pending) return;
    setUpdates((current) => {
      const next = { ...current };
      delete next[pending.module];
      return next;
    });
    try {
      await fetch("/api/module-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: pending.module, through: pending.latestAt }),
        keepalive: true,
      });
    } catch {
      void load();
    }
  }

  return <>
    <div className="grid h-[4.65rem] grid-cols-[5rem_1fr_5rem] items-center bg-gradient-to-r from-[#083f82] to-[#0875bd] px-3 text-white sm:hidden">
      <button type="button" onClick={() => setOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-xl" aria-label="Abrir menu">
        <PortalIcon name="menu" className="h-7 w-7" />
      </button>
      <Link href="/dashboard" className="flex flex-col items-center leading-none" aria-label="Casa Timoni — Painel">
        <span className="text-[1.35rem] font-bold tracking-[.08em]">CASA TIMONI</span>
      </Link>
      <div className="flex items-center justify-end">
        <button type="button" onClick={() => setOpen(true)} className="relative flex h-10 w-10 items-center justify-center rounded-xl" aria-label={total ? `${total} atualizações` : "Abrir notificações"}>
          <PortalIcon name="bell" className="h-6 w-6" />
          {total > 0 ? <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-red-500 px-1 text-center text-[.68rem] font-bold leading-5 text-white">{total > 99 ? "99+" : total}</span> : null}
        </button>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-semibold ring-1 ring-white/25" aria-label={`Usuário ${initials}`}>{initials}</span>
      </div>
    </div>

    {open ? <div className="fixed inset-0 z-[80] sm:hidden" role="dialog" aria-modal="true" aria-label="Menu principal">
      <button type="button" className="absolute inset-0 bg-slate-950/60" onClick={() => setOpen(false)} aria-label="Fechar menu" />
      <aside className="absolute inset-y-0 left-0 flex w-[84%] max-w-[22rem] flex-col bg-white shadow-2xl">
        <div className="flex h-[6.3rem] items-center justify-between border-b border-slate-100 px-5">
          <Link href="/dashboard" onClick={() => setOpen(false)} className="flex flex-col items-center text-[#084a8e]" aria-label="Casa Timoni — Painel">
            <span className="text-[1.2rem] font-bold tracking-[.08em]">CASA TIMONI</span>
          </Link>
          <button type="button" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center text-slate-800" aria-label="Fechar menu"><PortalIcon name="close" className="h-6 w-6" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-3" aria-label="Menu mobile">
          {items.map((item, index) => {
            const pending = item.updateModule ? updates[item.updateModule] : undefined;
            return <Link key={`${item.label}-${index}`} href={item.href} onClick={() => void openItem(item)} className={`flex min-h-12 items-center gap-4 rounded-xl px-3 text-[1.05rem] font-medium text-slate-900 ${index === 0 ? "bg-blue-50" : ""}`}>
              <span className={item.color}><PortalIcon name={item.icon} className="h-6 w-6" /></span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {pending ? <span className="min-w-7 rounded-full bg-red-500 px-2 text-center text-xs font-bold leading-7 text-white">{pending.count}</span> : null}
              <span className="text-2xl font-light text-slate-500">›</span>
            </Link>;
          })}
          {showGuide ? <Link href="/configuracoes#guia" onClick={() => setOpen(false)} className="mt-2 flex min-h-14 items-center gap-4 border-y border-slate-200 px-3 text-[1.05rem] font-medium text-slate-900"><PortalIcon name="guide" className="h-6 w-6 text-slate-800"/><span className="flex-1">Guia de uso</span><span className="text-2xl font-light text-slate-500">›</span></Link> : null}
          <button type="button" onClick={() => void signOut({ callbackUrl: "/login" })} className="mt-2 flex min-h-14 w-full items-center gap-4 border-b border-slate-200 px-3 text-left text-[1.05rem] font-medium text-slate-900"><PortalIcon name="logout" className="h-6 w-6"/><span>Sair</span></button>
        </nav>
      </aside>
    </div> : null}
  </>;
}
