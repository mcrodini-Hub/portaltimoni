"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Contact = {
  name: string;
  email: string;
  unread: number;
  lastMessageAt: string | null;
  lastMessagePreview: string;
};
type Message = { id: string; sender_user_id: string; recipient_user_id: string; body: string; created_at: string; read_at: string | null };
type Overview = { currentUser?: { email: string; name: string }; contacts: Contact[]; totalUnread: number };

function formatActivity(value: string | null) {
  if (!value) return "Sem mensagens";
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  return sameDay
    ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date)
    : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

export default function InternalChatPanel({ open, onClose, onUnreadChange }: { open: boolean; onClose: () => void; onUnreadChange?: (count: number) => void }) {
  const [overview, setOverview] = useState<Overview>({ contacts: [], totalUnread: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadOverview = useCallback(async () => {
    const response = await fetch("/api/internal-chat", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível carregar o chat.");
    const overviewData = data as Overview;
    setOverview(overviewData);
    onUnreadChange?.(overviewData.totalUnread || 0);
    setSelected((value) => value || overviewData.contacts[0]?.email || null);
  }, [onUnreadChange]);

  const loadMessages = useCallback(async (peer: string, markRead: boolean) => {
    const response = await fetch(`/api/internal-chat?peer=${encodeURIComponent(peer)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível carregar esta conversa.");
    setMessages(data.messages || []);
    setCurrentUserId(data.currentUserId || "");
    if (markRead) {
      await fetch("/api/internal-chat", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ peer }) });
      await loadOverview();
    }
  }, [loadOverview]);

  const refresh = useCallback(async () => {
    try {
      await loadOverview();
      if (selected) await loadMessages(selected, open);
    } catch (cause) {
      if (open) setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o chat.");
    }
  }, [loadMessages, loadOverview, open, selected]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5_000);
    return () => window.clearInterval(interval);
  }, [open, refresh]);

  useEffect(() => {
    if (!open || !selected) return;
    setError("");
    void loadMessages(selected, true).catch(() => setError("Não foi possível carregar esta conversa."));
  }, [open, selected, loadMessages]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return overview.contacts;
    return overview.contacts.filter((item) =>
      item.name.toLocaleLowerCase("pt-BR").includes(term)
      || item.email.toLocaleLowerCase("pt-BR").includes(term)
      || item.lastMessagePreview.toLocaleLowerCase("pt-BR").includes(term),
    );
  }, [overview.contacts, search]);

  async function sendMessage() {
    const message = draft.trim();
    if (!selected || !message || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/internal-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ peer: selected, message }) });
      if (!response.ok) throw new Error();
      setDraft("");
      await loadMessages(selected, false);
      await loadOverview();
    } catch {
      setError("Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;
  const contact = overview.contacts.find((item) => item.email === selected) ?? null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-slate-950/20 sm:items-center sm:justify-end sm:p-5" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Fechar chat" />
      <section className="relative flex h-[86vh] w-full max-w-4xl overflow-hidden bg-white shadow-2xl sm:h-[680px] sm:rounded-2xl sm:border sm:border-slate-200">
        <aside className={`${selected ? "hidden sm:flex" : "flex"} w-full flex-col border-r border-slate-200 bg-slate-50 sm:w-80`}>
          <div className="border-b border-slate-200 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-blue-700">Casa Timoni</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Chat interno</h2>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar conversa"
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                aria-label="Buscar conversa"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredContacts.length === 0 ? <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhuma conversa encontrada.</p> : null}
            {filteredContacts.map((item) => {
              const hasUnread = item.unread > 0;
              return (
                <button
                  key={item.email}
                  type="button"
                  onClick={() => setSelected(item.email)}
                  className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${hasUnread ? "bg-blue-50 ring-1 ring-blue-100 hover:bg-blue-100" : "text-slate-800 hover:bg-white"}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0F2D8F] text-sm font-semibold text-white">{item.name.slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`block min-w-0 flex-1 truncate text-sm ${hasUnread ? "font-bold text-slate-950" : "font-semibold text-slate-800"}`}>{item.name}</span>
                      <span className={`shrink-0 text-[11px] ${hasUnread ? "font-semibold text-blue-700" : "text-slate-400"}`}>{formatActivity(item.lastMessageAt)}</span>
                    </span>
                    <span className={`mt-0.5 block truncate text-xs ${hasUnread ? "font-medium text-slate-700" : "text-slate-500"}`}>
                      {item.lastMessagePreview || "Mensagem direta"}
                    </span>
                  </span>
                  {hasUnread ? <span className="flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">{item.unread > 99 ? "99+" : item.unread}</span> : null}
                </button>
              );
            })}
          </div>
        </aside>
        <div className={`${selected ? "flex" : "hidden sm:flex"} min-w-0 flex-1 flex-col`}>
          <div className="flex min-h-16 items-center gap-3 border-b border-slate-200 px-4">
            <button type="button" className="px-2 py-2 text-xl text-slate-500 sm:hidden" onClick={() => setSelected(null)}>‹</button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950">{contact?.name || "Selecione uma conversa"}</p>
              <p className="text-xs text-slate-500">{contact?.lastMessageAt ? `Última atividade ${formatActivity(contact.lastMessageAt)}` : "Chat interno · equipe autorizada"}</p>
            </div>
            <button type="button" className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100" onClick={onClose}>Fechar</button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50/50 px-4 py-5 sm:px-6">
            {messages.length === 0 ? <div className="mt-16 text-center text-sm text-slate-500">Envie a primeira mensagem.</div> : <div className="space-y-3">{messages.map((message) => { const mine = message.sender_user_id === currentUserId; return <div key={message.id} className="flex"><div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${mine ? "ml-auto bg-[#0F2D8F] text-white" : "mr-auto border border-slate-200 bg-white text-slate-800"}`}><p className="whitespace-pre-wrap break-words leading-5">{message.body}</p><p className={`mt-1 text-right text-[10px] ${mine ? "text-blue-100" : "text-slate-400"}`}>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.created_at))}</p></div></div>; })}</div>}
          </div>
          <div className="border-t border-slate-200 p-3 sm:p-4">{error ? <p className="mb-2 text-xs font-medium text-red-600">{error}</p> : null}<div className="flex items-end gap-2 rounded-2xl border border-slate-300 p-2 shadow-sm focus-within:border-blue-400"><textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} rows={1} maxLength={4000} placeholder={contact ? `Mensagem para ${contact.name}` : "Selecione uma conversa"} className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none" /><button type="button" disabled={!selected || !draft.trim() || sending} onClick={() => void sendMessage()} className="min-h-10 rounded-xl bg-[#0F2D8F] px-4 text-sm font-semibold text-white disabled:opacity-40">Enviar</button></div></div>
        </div>
      </section>
    </div>
  );
}
