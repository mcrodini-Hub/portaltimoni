"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AvisosNavLink from "@/components/avisos-nav-link";
import type { UpdateModule } from "@/lib/module-updates";

type NavItem = {
  href: string;
  targetHref: string;
  label: string;
  updateModule: UpdateModule;
};

type PendingUpdate = { module: UpdateModule; count: number; latestAt: string };

export default function ModuleUpdatesNav({
  items,
  isCica,
  linkClass,
}: {
  items: NavItem[];
  isCica: boolean;
  linkClass: string;
}) {
  const [updates, setUpdates] = useState<Record<string, PendingUpdate>>({});
  const [saving, setSaving] = useState<string>("");
  const [confirmed, setConfirmed] = useState<string>("");

  const load = useCallback(async () => {
    if (!isCica) return;
    try {
      const response = await fetch("/api/module-updates", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) return;
      const next: Record<string, PendingUpdate> = {};
      for (const item of data.updates || []) next[item.module] = item;
      setUpdates(next);
    } catch {
      // Uma falha temporária não deve impedir a navegação pelo Portal.
    }
  }, [isCica]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(load, 45_000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function markRead(item: PendingUpdate, label: string) {
    setSaving(item.module);
    try {
      const response = await fetch("/api/module-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module: item.module, through: item.latestAt }),
      });
      if (!response.ok) throw new Error("Falha ao confirmar leitura.");
      setUpdates((current) => {
        const next = { ...current };
        delete next[item.module];
        return next;
      });
      setConfirmed(item.module);
      window.setTimeout(() => setConfirmed((current) => current === item.module ? "" : current), 1_400);
    } catch {
      window.alert(`Não foi possível marcar as atualizações de ${label} como lidas.`);
    } finally {
      setSaving("");
    }
  }

  return items.map((item) => {
    const pending = updates[item.updateModule];
    const justConfirmed = confirmed === item.updateModule;
    return (
      <span key={item.href} className="inline-flex shrink-0 items-center">
        {item.href === "/colaboradores" ? (
          <AvisosNavLink className={linkClass} />
        ) : (
          <Link href={item.targetHref} className={linkClass}>{item.label}</Link>
        )}
        {(pending || justConfirmed) && (
          <button
            type="button"
            disabled={!pending || saving === item.updateModule}
            onClick={() => pending && void markRead(pending, item.label)}
            title={`Marcar atualizações de ${item.label} como lidas`}
            aria-label={pending
              ? `${pending.count} atualização${pending.count === 1 ? "" : "ões"} em ${item.label}. Marcar como lida${pending.count === 1 ? "" : "s"}.`
              : `Atualizações de ${item.label} marcadas como lidas.`}
            className="-ml-3 inline-flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 disabled:opacity-70 sm:h-8 sm:w-8"
          >
            {justConfirmed ? (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-xs font-bold text-blue-950">✓</span>
            ) : (
              <span className="h-3.5 w-3.5 rounded-full bg-amber-400 shadow-[0_0_0_2px_rgba(255,255,255,0.22)]" />
            )}
          </button>
        )}
      </span>
    );
  });
}
