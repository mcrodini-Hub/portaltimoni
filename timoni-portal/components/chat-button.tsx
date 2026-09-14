"use client";

import { useCallback, useEffect, useState } from "react";
import InternalChatPanel from "@/components/internal-chat-panel";

function GoogleChatMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path fill="#0ABC65" d="M13 8h38c5.5 0 10 4.5 10 10v26c0 5.5-4.5 10-10 10H32L17 63V54h-4C7.5 54 3 49.5 3 44V18C3 12.5 7.5 8 13 8Z" />
      <path d="M20 30c3.4 6.3 9.2 9.5 15.5 9.5S47.7 36.3 51 30" fill="none" stroke="#FFFFFF" strokeWidth="5.5" strokeLinecap="round" />
    </svg>
  );
}

export default function ChatButton({ mobile = false, onOpen }: { mobile?: boolean; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const response = await fetch("/api/internal-chat", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setUnread(Number(data.totalUnread || 0));
    } catch {}
  }, []);

  useEffect(() => {
    void loadUnread();
    const interval = window.setInterval(loadUnread, 30000);
    return () => window.clearInterval(interval);
  }, [loadUnread]);

  const badge = unread > 0 ? <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[.65rem] font-bold text-white ring-2 ring-white">{unread > 99 ? "99+" : unread}</span> : null;
  const openChat = () => { onOpen?.(); setOpen(true); };

  return (
    <>
      {mobile ? (
        <button type="button" onClick={openChat} className="mt-2 flex min-h-14 w-full items-center gap-4 border-b border-slate-200 px-3 text-left text-[1.05rem] font-medium text-slate-900">
          <span className="relative flex h-10 w-10 items-center justify-center"><GoogleChatMark className="h-10 w-10" />{badge}</span>
          <span className="flex-1">Chat</span>
        </button>
      ) : (
        <button type="button" onClick={openChat} className="relative order-2 inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-1.5 transition hover:bg-white/10 sm:order-none" aria-label={unread ? `Chat: ${unread} mensagens não lidas` : "Abrir chat interno"} title="Chat">
          <GoogleChatMark className="h-9 w-9" />{badge}
        </button>
      )}
      <InternalChatPanel open={open} onClose={() => setOpen(false)} onUnreadChange={setUnread} />
    </>
  );
}
