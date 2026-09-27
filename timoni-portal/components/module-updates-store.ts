"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { UpdateModule } from "@/lib/module-updates";

export type PendingUpdate = {
  module: UpdateModule;
  count: number;
  latestAt: string;
  summaries?: string[];
};

type UpdateState = Record<string, PendingUpdate>;

let state: UpdateState = {};
let listeners = new Set<() => void>();
let acknowledgedThrough: Record<string, string> = {};
let intervalId: number | null = null;
let activeConsumers = 0;
let loading: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function setState(next: UpdateState) {
  state = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return {};
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
      setState(next);
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
  const pending = state[module];
  if (!pending) return;

  acknowledgedThrough[module] = pending.latestAt;
  const next = { ...state };
  delete next[module];
  setState(next);

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
  const updates = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

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
