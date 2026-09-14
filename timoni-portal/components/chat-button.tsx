"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PortalIcon from "@/components/portal-icon";

export default function ChatButton({ mobile = false, onOpen }: { mobile?: boolean; onOpen?: () => void }) {
  const [unreadConversations, setUnreadConversations] = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const response = await fetch("/api/chat-unread", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setUnreadConversations(Number(data.unreadConversations || 0));
    } catch {
      // O botão continua disponível mesmo se a consulta de notificações falhar.
    }
  }, []);

  useEffect(() => {
    void loadUnread();
    const interval = window.setInterval(loadUnread, 30_000);
    const onFocus = () => void loadUnread();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadUnread]);

  const badge = unreadConversations > 0 ? (
    <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-red-500 px-1 text-center text-[.65rem] font-bold leading-5 text-white">
      {unreadConversations > 99 ? "99+" : unreadConversations}
    </span>
  ) : null;

  if (mobile) {
    return (
      <Link
        href="https://chat.google.com/app/home"
        target="_blank"
        rel="noopener noreferrer"
        onClick={onOpen}
        className="mt-2 flex min-h-14 w-full items-center gap-4 border-b border-slate-200 px-3 text-left text-[1.05rem] font-medium text-slate-900"
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200">
          <PortalIcon name="chat" className="h-6 w-6 text-emerald-600" />
          {badge}
        </span>
        <span className="flex-1">Chat</span>
      </Link>
    );
  }

  return (
    <Link
      href="https://chat.google.com/app/home"
      target="_blank"
      rel="noopener noreferrer"
      className="relative order-2 inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-white/40 transition hover:bg-slate-50 sm:order-none"
      aria-label={unreadConversations ? `Chat: ${unreadConversations} conversas não lidas` : "Abrir Google Chat"}
    >
      <PortalIcon name="chat" className="h-5 w-5 text-emerald-600" />
      <span>Chat</span>
      {badge}
    </Link>
  );
}
