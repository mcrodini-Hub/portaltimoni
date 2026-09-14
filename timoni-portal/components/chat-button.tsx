"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const CHAT_URL = "https://chat.google.com/app/home";

function GoogleChatMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        fill="#2296E8"
        d="M12 8h38a8 8 0 0 1 8 8v27a8 8 0 0 1-8 8H29L17 60v-9h-5a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8Z"
      />
      <rect x="17" y="23" width="29" height="5" rx="2.5" fill="#FFFFFF" />
      <rect x="17" y="34" width="23" height="5" rx="2.5" fill="#FFFFFF" />
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
