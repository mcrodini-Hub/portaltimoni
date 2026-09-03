"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import AvisosNavLink from "@/components/avisos-nav-link";
import type { UpdateModule } from "@/lib/module-updates";

type NavItem = {
  href: string;
  targetHref: string;
  label: string;
  updateModule: UpdateModule;
};

type PendingUpdate = { module: UpdateModule; count: number; latestAt: string; summaries: string[] };

export default function ModuleUpdatesNav({
  items,
  canViewUpdates,
  linkClass,
}: {
  items: NavItem[];
  canViewUpdates: boolean;
  linkClass: string;
}) {
  const [updates, setUpdates] = useState<Record<string, PendingUpdate>>({});
  const pathname = usePathname();
  const acknowledgedThrough = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!canViewUpdates) return;
    try {
      const response = await fetch("/api/module-updates", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) return;
      const next: Record<string, PendingUpdate> = {};
      for (const item of data.updates || []) {
        const acknowledgedAt = acknowledgedThrough.current[item.module];
        if (!acknowledgedAt || Date.parse(item.latestAt) > Date.parse(acknowledgedAt)) {
          next[item.module] = item;
        }
      }
      setUpdates(next);
    } catch {
      // Uma falha temporária não deve impedir a navegação pelo Portal.
    }
  }, [canViewUpdates]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 45_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const markRead = useCallback(async (item: PendingUpdate, showArrival: boolean) => {
    acknowledgedThrough.current[item.module] = item.latestAt;
    setUpdates((current) => {
      const next = { ...current };
      delete next[item.module];
      return next;
    });
    if (showArrival) {
      window.sessionStorage.setItem(`portal-module-arrival:${item.module}`, JSON.stringify(item));
      window.dispatchEvent(new CustomEvent("portal-module-arrival", { detail: item }));
    }
    try {
      const response = await fetch("/api/module-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: item.module, through: item.latestAt }),
        keepalive: true,
      });
      if (!response.ok) throw new Error("Falha ao confirmar leitura.");
    } catch {
      delete acknowledgedThrough.current[item.module];
      void load();
    }
  }, [load]);

  useEffect(() => {
    if (!canViewUpdates) return;
    const currentItem = items.find((item) => pathname === item.targetHref || pathname.startsWith(`${item.targetHref}/`));
    const pending = currentItem && updates[currentItem.updateModule];
    if (pending) void markRead(pending, true);
  }, [canViewUpdates, items, markRead, pathname, updates]);

  return items.map((item) => {
    const pending = updates[item.updateModule];
    const content = <span>{item.label}</span>;
    return (
      <span key={item.href} className="inline-flex shrink-0">
        {item.href === "/colaboradores" && !canViewUpdates ? (
          <AvisosNavLink className={linkClass} showActiveCount={!canViewUpdates} />
        ) : (
          <Link
            href={item.targetHref}
            onClick={() => pending && void markRead(pending, true)}
            className={`${linkClass} inline-flex items-center gap-2 ${pending ? "bg-red-500 text-white hover:bg-red-400" : ""}`}
            aria-label={pending ? `${item.label} tem novidades. Abrir e visualizar.` : item.label}
          >
            {content}
            {pending && <span className="text-[10px] font-bold uppercase tracking-wide">Novo</span>}
          </Link>
        )}
      </span>
    );
  });
}
