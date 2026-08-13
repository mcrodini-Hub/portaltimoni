"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  type: "mensagem" | "estoque" | "comunicado";
  title: string;
  body: string;
  url: string;
};

type NotificationResponse = { ok: boolean; items?: NotificationItem[] };

const SEEN_PREFIX = "portalTimoniNotificationSeen:v3";
const HISTORY_PREFIX = "portalTimoniNotificationHistory:v1";
const POLL_INTERVAL_MS = 45_000;
const HISTORY_LIMIT = 100;

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

function seenKey(email: string) {
  return SEEN_PREFIX + ":" + normalizedEmail(email);
}

function historyKey(email: string) {
  return HISTORY_PREFIX + ":" + normalizedEmail(email);
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
    // O histórico continua visível durante a sessão.
  }
}

function readHistory(key: string) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "[]") as NotificationItem[];
  } catch {
    return [];
  }
}

function saveHistory(key: string, items: NotificationItem[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
  } catch {
    // O histórico continua visível durante a sessão.
  }
}

function historyIdentity(item: NotificationItem) {
  if (item.type === "comunicado") {
    const parts = item.id.split(":");
    return parts.slice(0, 2).join(":");
  }
  return item.id;
}

function mergeHistory(current: NotificationItem[], previous: NotificationItem[]) {
  const merged = new Map<string, NotificationItem>();
  [...current, ...previous].forEach((item) => {
    const identity = historyIdentity(item);
    if (!merged.has(identity)) merged.set(identity, item);
  });
  return Array.from(merged.values()).slice(0, HISTORY_LIMIT);
}

function typeLabel(type: NotificationItem["type"]) {
  if (type === "estoque") return "Estoque";
  if (type === "comunicado") return "Comunicado";
  return "Mensagem de colaborador";
}

export default function PainelNotificationsClient({ email }: { email: string }) {
  const readKey = useMemo(() => seenKey(email), [email]);
  const savedHistoryKey = useMemo(() => historyKey(email), [email]);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const lastAutoOpened = useRef("");

  const check = useCallback(async () => {
    try {
      const response = await fetch("/api/painel-notifications", { cache: "no-store" });
      const data = (await response.json()) as NotificationResponse;
      if (!data.ok) return;

      const current = data.items || [];
      const history = mergeHistory(current, readHistory(savedHistoryKey));
      const seen = readSeen(readKey);
      const unread = current.filter((item) => !seen.has(item.id));
      const unreadSet = new Set(unread.map((item) => item.id));
      const signature = unread.map((item) => item.id).sort().join("|");

      saveHistory(savedHistoryKey, history);
      setItems(history);
      setUnreadIds(unreadSet);

      if (unread.length && signature !== lastAutoOpened.current) {
        lastAutoOpened.current = signature;
        setOpen(true);
      }
    } catch {
      // Uma falha temporária não deve interromper o uso do Portal.
    }
  }, [readKey, savedHistoryKey]);

  useEffect(() => {
    setItems(readHistory(savedHistoryKey));
    check();
    const interval = window.setInterval(check, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [check, savedHistoryKey]);

  function markAllRead() {
    const seen = readSeen(readKey);
    unreadIds.forEach((id) => seen.add(id));
    saveSeen(readKey, seen);
    setUnreadIds(new Set());
    setOpen(false);
  }

  function openItem(item: NotificationItem) {
    const seen = readSeen(readKey);
    seen.add(item.id);
    saveSeen(readKey, seen);
    setUnreadIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
    window.location.href = item.url;
  }

  const unreadCount = unreadIds.size;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unreadCount ? unreadCount + " notificações não lidas" : "Abrir histórico de notificações"}
        className="fixed right-20 top-3 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-blue-200 bg-white text-xl shadow-lg transition hover:bg-blue-50"
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-xs font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="notification-title">
          <section className="max-h-[85vh] w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Central de novidades</p>
                <h2 id="notification-title" className="mt-1 text-2xl font-semibold text-slate-950">
                  {unreadCount
                    ? unreadCount + (unreadCount === 1 ? " aviso não lido" : " avisos não lidos")
                    : "Nenhum aviso novo"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Histórico recente: {items.length}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar central de novidades"
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600"
              >
                Fechar
              </button>
            </header>

            <div className="max-h-[58vh] space-y-3 overflow-y-auto p-5">
              {items.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm text-slate-500">Ainda não há novidades no histórico.</p>
              ) : (
                items.map((item) => {
                  const unread = unreadIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openItem(item)}
                      className={
                        "w-full rounded-2xl border p-4 text-left transition " +
                        (unread
                          ? "border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100")
                      }
                    >
                      <span className={"text-xs font-semibold uppercase tracking-wider " + (unread ? "text-blue-700" : "text-slate-500")}>
                        {typeLabel(item.type)} · {unread ? "Novo" : "Lido"}
                      </span>
                      <strong className="mt-1 block text-base text-slate-950">{item.title}</strong>
                      <span className="mt-1 block text-sm leading-5 text-slate-700">{item.body}</span>
                      <span className="mt-3 block text-xs font-semibold text-blue-800">Abrir →</span>
                    </button>
                  );
                })
              )}
            </div>

            {unreadCount > 0 && (
              <footer className="flex justify-end border-t border-slate-200 p-4">
                <button type="button" onClick={markAllRead} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white">
                  Marcar novidades como lidas
                </button>
              </footer>
            )}
          </section>
        </div>
      )}
    </>
  );
}
