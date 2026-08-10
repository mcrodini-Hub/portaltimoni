"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  type: "mensagem" | "estoque";
  title: string;
  body: string;
  url: string;
};

type NotificationResponse = {
  ok: boolean;
  items?: NotificationItem[];
};

const STORAGE_PREFIX = "portalTimoniNotificationSeen";
const POLL_INTERVAL_MS = 45_000;

function getStorageKey(email: string) {
  return `${STORAGE_PREFIX}:${email.trim().toLowerCase()}`;
}

function readSeenIds(key: string) {
  try {
    return new Set<string>(JSON.parse(window.localStorage.getItem(key) || "[]"));
  } catch {
    return new Set<string>();
  }
}

function writeSeenIds(key: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(ids).slice(-150)));
  } catch {
    // localStorage pode estar indisponível em modo restrito.
  }
}

export default function PainelNotificationsClient({ email }: { email: string }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [enabled, setEnabled] = useState(false);
  const firstLoadDone = useRef(false);
  const storageKey = useMemo(() => getStorageKey(email), [email]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    setEnabled(Notification.permission === "granted");
  }, []);

  const showNotification = useCallback((item: NotificationItem) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const notification = new Notification(item.title, {
      body: item.body,
      tag: item.id,
      renotify: false,
    });

    notification.onclick = () => {
      window.focus();
      window.location.href = item.url;
      notification.close();
    };
  }, []);

  const checkNotifications = useCallback(async () => {
    if (typeof window === "undefined") return;

    let data: NotificationResponse | null = null;
    try {
      const response = await fetch("/api/painel-notifications", { cache: "no-store" });
      data = await response.json();
    } catch {
      data = null;
    }

    if (!data?.ok || !data.items?.length) {
      firstLoadDone.current = true;
      return;
    }

    const seenIds = readSeenIds(storageKey);
    const newItems = data.items.filter((item) => !seenIds.has(item.id));

    for (const item of data.items) seenIds.add(item.id);
    writeSeenIds(storageKey, seenIds);

    if (firstLoadDone.current && Notification.permission === "granted") {
      for (const item of newItems.slice(0, 3)) showNotification(item);
    }

    firstLoadDone.current = true;
  }, [showNotification, storageKey]);

  useEffect(() => {
    checkNotifications();
    const interval = window.setInterval(checkNotifications, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [checkNotifications]);

  async function requestPermission() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    setEnabled(result === "granted");
    if (result === "granted") {
      await checkNotifications();
      new Notification("Portal Timoni", {
        body: "Notificações ativadas para mensagens do Painel e solicitações do Estoque.",
        tag: "portal-timoni-notificacoes-ativas",
      });
    }
  }

  if (permission === "unsupported") return null;
  if (enabled) return null;
  if (permission === "denied") return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 shadow-sm sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <span className="font-medium">Ative as notificações do Chrome para receber avisos do Painel e do Estoque.</span>
        <button
          type="button"
          onClick={requestPermission}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
        >
          Ativar notificações
        </button>
      </div>
    </div>
  );
}
