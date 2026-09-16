"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import PortalIcon, { type PortalIconName } from "@/components/portal-icon";
import ChatButton from "@/components/chat-button";
import type { UpdateModule } from "@/lib/module-updates";

type MobileNavItem = { href: string; targetHref?: string; label: string; updateModule?: UpdateModule; icon: PortalIconName; color: string; external?: boolean };
type PendingUpdate = { module: UpdateModule; count: number; latestAt: string };

export default function MobilePortalHeader({ items, showUpdates, showGuide, showChat, initials }: { items: MobileNavItem[]; showUpdates: boolean; showGuide: boolean; showChat: boolean; initials: string }) {
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

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKey); };
  }, [open]);

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
    <div className="portal-mobile-header grid h-16 grid-cols-[2.75rem_1fr_auto] items-center bg-[#0F2D8F] px-3 text-white sm:hidden">
      <button type="button" onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-lg" aria-label="Abrir menu" aria-expanded={open} aria-controls="portal-mobile-menu">
        <PortalIcon name="menu" className="h-6 w-6" />
      </button>
      <Link href="/dashboard" className="flex items-center justify-start leading-none" aria-label="Casa Timoni — Painel">
        <span className="text-base font-bold tracking-tight">Casa Timoni</span>
      </Link>
      <div className="flex items-center justify-end gap-1">
        <button type="button" onClick={() => setOpen(true)} className="relative flex h-9 w-9 items-center justify-center rounded-lg" aria-label={total ? `${total} atualizações` : "Abrir notificações"}>
          <PortalIcon name="bell" className="h-5 w-5" />
          {total > 0 ? <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[.62rem] font-bold leading-4 text-white">{total > 99 ? "99+" : total}</span> : null}
        </button>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold ring-1 ring-white/20" aria-label={`Usuário ${initials}`}>{initials}</span>
      </div>
    </div>

    {open ? createPortal(<div id="portal-mobile-menu" className="fixed inset-0 z-[80] sm:hidden" role="dialog" aria-modal="true" aria-label="Menu principal">
      <button type="button" className="absolute inset-0 bg-slate-950/45" onClick={() => setOpen(false)} aria-label="Fechar menu" />
      <aside className="absolute inset-y-0 left-0 flex w-[78%] max-w-[18rem] flex-col bg-white shadow-2xl">
        <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4">
          <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center text-[#0F2D8F]" aria-label="Casa Timoni — Painel">
            <span className="text-base font-bold tracking-tight">Casa Timoni</span>
          </Link>
          <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center text-slate-700" aria-label="Fechar menu"><PortalIcon name="close" className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Menu mobile">
          {items.map((item, index) => {
            const pending = item.updateModule ? updates[item.updateModule] : undefined;
            const active = (item.targetHref ?? item.href) === "/dashboard";
            return <Link key={`${item.label}-${index}`} href={item.targetHref ?? item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined} onClick={() => void openItem(item)} className={`flex min-h-9 items-center rounded-lg px-2.5 text-sm text-slate-800 transition ${active ? "bg-blue-50 font-bold text-[#0F2D8F]" : "font-normal hover:bg-slate-50"}`}>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {pending ? <span className="ml-2 min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[11px] font-bold leading-5 text-white">{pending.count}</span> : null}
            </Link>;
          })}
          {showGuide ? <Link href="/configuracoes#guia" onClick={() => setOpen(false)} className="mt-1 flex min-h-9 items-center border-t border-slate-200 px-2.5 pt-1 text-sm font-normal text-slate-800"><span className="flex-1">Guia de uso</span></Link> : null}
          {showChat ? <ChatButton mobile /> : null}
          <button type="button" onClick={() => void signOut({ callbackUrl: "/login" })} className="mt-1 flex min-h-9 w-full items-center border-t border-slate-200 px-2.5 pt-1 text-left text-sm font-normal text-slate-800"><span>Sair</span></button>
        </nav>
      </aside>
    </div>, document.body) : null}
  </>;
}
