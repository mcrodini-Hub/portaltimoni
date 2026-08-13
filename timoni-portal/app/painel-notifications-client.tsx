"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type NotificationItem = {
  id: string;
  type: "mensagem" | "estoque" | "comunicado";
  title: string;
  body: string;
  url: string;
};

type NotificationResponse = { ok: boolean; items?: NotificationItem[] };

const STORAGE_PREFIX = "portalTimoniNotificationSeen:v2";
const POLL_INTERVAL_MS = 45_000;

function storageKey(email: string) {
  return STORAGE_PREFIX + ":" + email.trim().toLowerCase();
}

function readSeen(key: string) {
  try {
    return new Set<string>(JSON.parse(window.localStorage.getItem(key) || "[]"));
  } catch {
    return new Set<string>();
  }
}

function saveSeen(key: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(ids).slice(-300)));
  } catch {
    // O aviso continua funcionando na sessão mesmo sem localStorage.
  }
}

function typeLabel(type: NotificationItem["type"]) {
  if (type === "estoque") return "Estoque";
  if (type === "comunicado") return "Comunicado";
  return "Mensagem de colaborador";
}

export default function PainelNotificationsClient({ email }: { email: string }) {
  const key = useMemo(() => storageKey(email), [email]);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  const check = useCallback(async () => {
    try {
      const response = await fetch("/api/painel-notifications", { cache: "no-store" });
      const data = (await response.json()) as NotificationResponse;
      if (!data.ok) return;
      const seen = readSeen(key);
      const unread = (data.items || []).filter((item) => !seen.has(item.id));
      setItems(unread);
      if (unread.length) setOpen(true);
    } catch {
      // Uma falha temporária não deve interromper o uso do Portal.
    }
  }, [key]);

  useEffect(() => {
    check();
    const interval = window.setInterval(check, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [check]);

  function markAllRead() {
    const seen = readSeen(key);
    items.forEach((item) => seen.add(item.id));
    saveSeen(key, seen);
    setItems([]);
    setOpen(false);
  }

  function openItem(item: NotificationItem) {
    const seen = readSeen(key);
    seen.add(item.id);
    saveSeen(key, seen);
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    window.location.href = item.url;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={items.length ? items.length + " notificações não lidas" : "Nenhuma notificação nova"}
        className="fixed right-20 top-3 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-blue-200 bg-white text-xl shadow-lg transition hover:bg-blue-50"
      >
        <span aria-hidden="true">🔔</span>
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-xs font-bold text-white">
            {items.length > 99 ? "99+" : items.length}
          </span>
        )}
      </button>

      {open && items.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="notification-title">
          <section className="max-h-[85vh] w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Novidades no Portal</p>
                <h2 id="notification-title" className="mt-1 text-2xl font-semibold text-slate-950">
                  {items.length} aviso{items.length === 1 ? " novo" : "s novos"}
                </h2>
              </div>
              <button type="button" onClick={markAllRead} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600">
                Fechar
              </button>
            </header>

            <div className="max-h-[58vh] space-y-3 overflow-y-auto p-5">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className="w-full rounded-2xl border border-blue-100 bg-blue-50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-100"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">{typeLabel(item.type)}</span>
                  <strong className="mt-1 block text-base text-slate-950">{item.title}</strong>
                  <span className="mt-1 block text-sm leading-5 text-slate-700">{item.body}</span>
                  <span className="mt-3 block text-xs font-semibold text-blue-800">Abrir →</span>
                </button>
              ))}
            </div>

            <footer className="flex justify-end border-t border-slate-200 p-4">
              <button type="button" onClick={markAllRead} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white">
                Marcar como lido
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
