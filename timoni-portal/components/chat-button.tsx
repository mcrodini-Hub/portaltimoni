"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const CHAT_URL = "https://chat.google.com/app/home";

function GoogleChatMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="chat-app-highlight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7DDDEB" stopOpacity="0.95" />
          <stop offset="1" stopColor="#7DDDEB" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        fill="#0ABC65"
        d="M13 8h38c5.5 0 10 4.5 10 10v26c0 5.5-4.5 10-10 10H32L17 63V54h-4C7.5 54 3 49.5 3 44V18C3 12.5 7.5 8 13 8Z"
      />
      <path
        fill="url(#chat-app-highlight)"
        d="M10 18c5-6 13-8 23-8h18c5.5 0 10 4.5 10 10v8c-8-5-17-7-28-7-9 0-17 1-23 4Z"
      />
      <path
        d="M20 30c3.4 6.3 9.2 9.5 15.5 9.5S47.7 36.3 51 30"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
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
    <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-center text-[.65rem] font-bold leading-5 text-white shadow-sm ring-2 ring-white">
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
        <span className="relative flex h-10 w-10 items-center justify-center">
          <GoogleChatMark className="h-10 w-10" />
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
      className="relative order-2 inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-transparent px-1.5 transition hover:bg-white/10 sm:order-none"
      aria-label={unreadConversations ? `Chat: ${unreadConversations} conversas não lidas` : "Abrir Google Chat"}
      title="Chat"
    >
      <GoogleChatMark className="h-9 w-9" />
      {badge}
    </button>
  );
}
