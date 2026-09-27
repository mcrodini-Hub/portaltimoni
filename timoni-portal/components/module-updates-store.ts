"use client";

import { useCallback, useEffect, useState } from "react";
import type { UpdateModule } from "@/lib/module-updates";

export type PendingUpdate = {
  module: UpdateModule;
  count: number;
  latestAt: string;
  summaries?: string[];
};

type UpdateState = Record<string, PendingUpdate>;

let sharedState: UpdateState = {};
const listeners = new Set<(next: UpdateState) => void>();
const acknowledgedThrough: Record<string, string> = {};
let intervalId: number | null = null;
let activeConsumers = 0;
let loading: Promise<void> | null = null;

function setSharedState(next: UpdateState) {
  sharedState = next;
  listeners.forEach((listener) => listener(next));
}

function subscribe(listener: (next: UpdateState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function load() {
  if (typeof window === "undefined") return;
  if (loading) return loading;

  loading = (async () => {
    try {
      const response = await fetch("/api/module-updates", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) return;

      const next: UpdateState = {};
      for (const item of data.updates || []) {
        const acknowledgedAt = acknowledgedThrough[item.module];
        if (!acknowledgedAt || Date.parse(item.latestAt) > Date.parse(acknowledgedAt)) {
          next[item.module] = item;
        }
      }
      setSharedState(next);
    } catch {
      // Uma falha temporária não deve impedir o uso do Portal.
    } finally {
      loading = null;
    }
  })();

  return loading;
}

function refreshWhenVisible() {
  if (typeof document !== "undefined" && !document.hidden) void load();
}

function startPolling() {
  if (typeof window === "undefined") return;
  activeConsumers += 1;
  if (activeConsumers > 1) return;

  refreshWhenVisible();
  intervalId = window.setInterval(refreshWhenVisible, 60_000);
  document.addEventListener("visibilitychange", refreshWhenVisible);
}

function stopPolling() {
  if (typeof window === "undefined") return;
  activeConsumers = Math.max(0, activeConsumers - 1);
  if (activeConsumers > 0) return;

  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
  document.removeEventListener("visibilitychange", refreshWhenVisible);
}

async function markRead(module: UpdateModule, showArrival = false) {
  const pending = sharedState[module];
  if (!pending) return;

  acknowledgedThrough[module] = pending.latestAt;
  const next = { ...sharedState };
  delete next[module];
  setSharedState(next);

  if (showArrival && typeof window !== "undefined") {
    window.sessionStorage.setItem(`portal-module-arrival:${module}`, JSON.stringify(pending));
    window.dispatchEvent(new CustomEvent("portal-module-arrival", { detail: pending }));
  }

  try {
    const response = await fetch("/api/module-updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module, through: pending.latestAt }),
      keepalive: true,
    });
    if (!response.ok) throw new Error("Falha ao confirmar leitura.");
  } catch {
    delete acknowledgedThrough[module];
    await load();
  }
}

export function useModuleUpdates(enabled: boolean) {
  const [updates, setUpdates] = useState<UpdateState>(sharedState);

  useEffect(() => subscribe(setUpdates), []);

  useEffect(() => {
    if (!enabled) return;
    startPolling();
    return stopPolling;
  }, [enabled]);

  const reload = useCallback(() => load(), []);
  const acknowledge = useCallback(
    (module: UpdateModule, showArrival = false) => markRead(module, showArrival),
    [],
  );

  return { updates, reload, markRead: acknowledge };
}
