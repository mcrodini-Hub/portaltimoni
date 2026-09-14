"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const CHAT_URL = "https://chat.google.com/app/home";

function GoogleChatMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#00A67E" d="M8 6h32a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H22L11 45v-9H8a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4Z" />
      <path fill="#FFFFFF" d="M15 14h18a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H23l-6 5v-5h-2a3 3 0 0 1-3-3V17a3 3 0 0 1 3-3Z" />
    </svg>
  );
}

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
    <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-red-500 px-1 text-center text-[.65rem] font-bold leading-5 text-white">
      {unreadConversations > 99 ? "99+" : unreadConversations}
    </span>
  ) : null;

  if (mobile) {
    return (
      <Link
        href={CHAT_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onOpen}
        className="mt-2 flex min-h-14 w-full items-center gap-4 border-b border-slate-200 px-3 text-left text-[1.05rem] font-medium text-slate-900"
      >
        <span className="relative flex h-8 w-8 items-center justify-center">
          <GoogleChatMark className="h-7 w-7" />
          {badge}
        </span>
        <span className="flex-1">Chat</span>
      </Link>
    );
  }

  const openCompactChat = () => {
    const width = 430;
    const height = Math.min(680, Math.max(560, window.screen.availHeight - 120));
    const left = Math.max(0, window.screen.availWidth - width - 24);
    const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
    const popup = window.open(
      CHAT_URL,
      "portal-timoni-google-chat",
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );

    if (popup) {
      popup.focus();
    } else {
      window.open(CHAT_URL, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <button
      type="button"
      onClick={openCompactChat}
      className="relative order-2 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 sm:order-none"
      aria-label={unreadConversations ? `Chat: ${unreadConversations} conversas não lidas` : "Abrir Google Chat"}
    >
      <GoogleChatMark className="h-[1.35rem] w-[1.35rem]" />
      <span>Chat</span>
      {badge}
    </button>
  );
}
