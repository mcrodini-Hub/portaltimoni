"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

type Contact = {
  name: string;
  email: string;
  unread: number;
  lastMessageAt: string | null;
  lastMessagePreview: string;
};
type Message = { id: string; sender_user_id: string; recipient_user_id: string; body: string; created_at: string; read_at: string | null; edited_at: string | null };
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
  const [minimized, setMinimized] = useState(false);
  const [contactsWidth, setContactsWidth] = useState(170);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [messageAction, setMessageAction] = useState<string | null>(null);
  const [conversationAction, setConversationAction] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadOverview = useCallback(async () => {
    const response = await fetch("/api/internal-chat", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível carregar o chat.");
    const overviewData = data as Overview;
    setOverview(overviewData);
    onUnreadChange?.(overviewData.totalUnread || 0);
    setSelected((value) => {
      if (value) return value;
      if (typeof window !== "undefined" && window.innerWidth >= 640) return overviewData.contacts[0]?.email || null;
      return null;
    });
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
    if (window.innerWidth < 640) {
      setSelected(null);
      setMessages([]);
    }
  }, [open]);

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
    if (open && !minimized) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, minimized, open]);

  useEffect(() => {
    if (!open) {
      setMinimized(false);
      setEditingMessage(null);
      setActiveMessageMenu(null);
      setConversationAction(false);
    }
  }, [open]);

  useEffect(() => {
    setEditingMessage(null);
    setActiveMessageMenu(null);
    setDraft("");
  }, [selected]);

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
      const response = editingMessage
        ? await fetch("/api/internal-chat", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ peer: selected, action: "edit", messageId: editingMessage.id, message }),
          })
        : await fetch("/api/internal-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ peer: selected, message }),
          });
      if (!response.ok) throw new Error();
      setDraft("");
      setEditingMessage(null);
      await loadMessages(selected, false);
      await loadOverview();
    } catch {
      setError(editingMessage ? "Não foi possível editar a mensagem." : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  function startEditingMessage(message: Message) {
    setEditingMessage(message);
    setDraft(message.body);
    setActiveMessageMenu(null);
  }

  async function removeMessage(message: Message) {
    if (!selected || messageAction || !window.confirm("Excluir esta mensagem?")) return;
    setMessageAction(message.id);
    setActiveMessageMenu(null);
    setError("");
    try {
      const response = await fetch("/api/internal-chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peer: selected, action: "message", messageId: message.id }),
      });
      if (!response.ok) throw new Error();
      if (editingMessage?.id === message.id) {
        setEditingMessage(null);
        setDraft("");
      }
      await loadMessages(selected, false);
      await loadOverview();
    } catch {
      setError("Não foi possível excluir a mensagem.");
    } finally {
      setMessageAction(null);
    }
  }

  async function clearConversation() {
    if (!selected || conversationAction || !window.confirm("Excluir esta conversa da sua visão? O histórico do outro usuário será preservado.")) return;
    setConversationAction(true);
    setError("");
    try {
      const response = await fetch("/api/internal-chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peer: selected, action: "conversation" }),
      });
      if (!response.ok) throw new Error();
      setMessages([]);
      setEditingMessage(null);
      setDraft("");
      setSelected(null);
      await loadOverview();
    } catch {
      setError("Não foi possível excluir esta conversa.");
    } finally {
      setConversationAction(false);
    }
  }

  function startContactsResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (window.innerWidth < 640) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = contactsWidth;
    const panelWidth = panelRef.current?.clientWidth ?? 500;
    const maxWidth = Math.max(190, Math.min(280, panelWidth - 250));

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setContactsWidth(Math.min(maxWidth, Math.max(150, startWidth + moveEvent.clientX - startX)));
    };
    const stopResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
    };

    document.body.style.setProperty("user-select", "none");
    document.body.style.setProperty("cursor", "col-resize");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
  }

  function startPanelWidthResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (window.innerWidth < 640 || !panelRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const panel = panelRef.current;
    const startX = event.clientX;
    const startWidth = panel.getBoundingClientRect().width;
    const maxWidth = Math.max(500, window.innerWidth - 16);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(maxWidth, Math.max(420, startWidth + startX - moveEvent.clientX));
      panel.style.width = `${nextWidth}px`;
      setContactsWidth((width) => Math.min(width, Math.max(150, nextWidth - 250)));
    };
    const stopResize = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.style.removeProperty("user-select");
      document.body.style.removeProperty("cursor");
    };

    document.body.style.setProperty("user-select", "none");
    document.body.style.setProperty("cursor", "ew-resize");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
  }

  if (!open) return null;
  const contact = overview.contacts.find((item) => item.email === selected) ?? null;
  const panelStyle = { "--contacts-width": `${contactsWidth}px` } as CSSProperties;

  if (minimized) {
    return (
      <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[80] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:z-[100]">
        <section className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-2xl sm:w-80">
          <button type="button" onClick={() => setMinimized(false)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2296E8] text-base text-white">☰</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[#0F2D8F]">Chat interno</span>
              <span className="block text-xs text-slate-500">Toque para restaurar</span>
            </span>
            {overview.totalUnread > 0 ? <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{overview.totalUnread}</span> : null}
          </button>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-slate-500 hover:bg-slate-100" aria-label="Fechar chat">×</button>
        </section>
      </div>
    );
  }

  return (
    <div id="internal-chat-dialog" className="fixed inset-x-0 bottom-0 top-16 z-[80] flex items-start justify-end overflow-hidden bg-slate-950/20 pt-2 sm:z-[100] sm:pt-0" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Fechar chat" />
      <section ref={panelRef} style={panelStyle} className="relative flex h-[calc(100%-0.5rem)] min-h-0 w-[92%] max-w-[390px] overflow-hidden rounded-tl-xl border-l border-t border-slate-200 bg-white font-sans shadow-2xl sm:h-full sm:w-[500px] sm:min-w-[420px] sm:max-w-[calc(100vw-1rem)] sm:rounded-none sm:border-t-0" title="Arraste a borda esquerda para ajustar a largura">
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajustar largura externa do chat"
          onPointerDown={startPanelWidthResize}
          className="group absolute inset-y-0 left-0 z-30 hidden w-3 cursor-ew-resize items-center justify-center sm:flex"
          title="Arraste para ajustar a largura externa do chat"
        >
          <span className="h-16 w-1 rounded-full bg-[#2296E8]/35 transition group-hover:bg-[#2296E8]" />
        </div>
        <aside className={`${selected ? "hidden sm:flex" : "flex"} w-full flex-col border-r border-slate-200 bg-slate-50 sm:w-[var(--contacts-width)] sm:shrink-0`}>
          <div className="border-b border-slate-200 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-blue-700">Casa Timoni</p>
            <h2 className="mt-1 text-[15px] font-semibold text-slate-950">Chat interno</h2>
            <div className="mt-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar conversa"
                className="w-full bg-transparent text-[13px] text-slate-800 outline-none placeholder:text-slate-400 sm:text-sm"
                aria-label="Buscar conversa"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredContacts.length === 0 ? <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhuma conversa encontrada.</p> : null}
            {filteredContacts.map((item) => {
              const hasUnread = item.unread > 0;
              const isSelected = item.email === selected;
              return (
                <button
                  key={item.email}
                  type="button"
                  onClick={() => setSelected(item.email)}
                  className={`mb-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition ${isSelected ? "bg-[#E4F2FD] text-[#0F2D8F] ring-1 ring-[#2296E8]/40" : hasUnread ? "bg-blue-50 ring-1 ring-blue-100 hover:bg-blue-100" : "text-slate-800 hover:bg-white"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`block min-w-0 flex-1 whitespace-normal break-words text-[13px] leading-4 sm:text-[11.5px] sm:text-black ${hasUnread ? "font-bold text-slate-950 sm:text-black" : "font-semibold text-slate-800 sm:text-black"}`}>{item.name}</span>
                      <span className={`shrink-0 text-[10px] sm:text-[8px] ${hasUnread ? "font-semibold text-blue-700" : "text-slate-400"}`}>{formatActivity(item.lastMessageAt)}</span>
                    </span>
                    <span className={`mt-0.5 block truncate text-[12px] sm:mt-1 sm:text-[11.5px] sm:text-black ${hasUnread ? "font-semibold text-slate-800 sm:text-black" : "text-slate-600 sm:text-black"}`}>
                      {item.lastMessagePreview || "Mensagem direta"}
                    </span>
                  </span>
                  {hasUnread ? <span className="flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white sm:text-[11px]">{item.unread > 99 ? "99+" : item.unread}</span> : null}
                </button>
              );
            })}
          </div>
        </aside>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajustar largura da lista de contatos"
          onPointerDown={startContactsResize}
          className="group hidden w-2 shrink-0 cursor-col-resize items-center justify-center bg-white sm:flex"
          title="Arraste para ajustar a divisão entre contatos e conversa"
        >
          <span className="h-10 w-0.5 rounded-full bg-slate-300 transition group-hover:bg-[#2296E8]" />
        </div>
        <div className={`${selected ? "flex" : "hidden sm:flex"} min-w-0 flex-1 flex-col`}>
          <div className="flex min-h-10 shrink-0 items-center gap-1.5 border-b border-slate-200 bg-white px-2.5 sm:min-h-12 sm:gap-3 sm:px-4">
            <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl font-semibold text-[#0F2D8F] sm:hidden" aria-label="Voltar para contatos" onClick={() => { setSelected(null); setMessages([]); }}>←</button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-slate-950 sm:text-[11.5px] sm:text-black">{contact?.name || "Selecione uma conversa"}</p>
              <p className="truncate text-[10px] text-slate-500 sm:text-[8px]">{contact?.lastMessageAt ? `Última atividade ${formatActivity(contact.lastMessageAt)}` : "Chat interno · equipe autorizada"}</p>
            </div>
            {contact ? <button type="button" disabled={conversationAction} className="shrink-0 rounded-lg px-1.5 py-2 text-[10px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 sm:px-2 sm:text-xs" onClick={() => void clearConversation()}>{conversationAction ? "Excluindo" : <><span className="sm:hidden">Excluir</span><span className="hidden sm:inline">Excluir chat</span></>}</button> : null}
            <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-[#0F2D8F] hover:bg-blue-50" onClick={() => setMinimized(true)} title="Minimizar chat" aria-label="Minimizar chat">−</button>
            <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg text-slate-500 hover:bg-slate-100 sm:h-auto sm:w-auto sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm" onClick={onClose} aria-label="Fechar chat"><span className="sm:hidden">×</span><span className="hidden sm:inline">Fechar</span></button>
          </div>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50 px-3 py-3 sm:px-4">
            {messages.length === 0 ? (
              <div className="mt-12 text-center text-[13px] text-slate-500 sm:mt-16 sm:text-sm">Envie a primeira mensagem.</div>
            ) : (
              <div className="space-y-1.5">
                {messages.map((message) => {
                  const mine = message.sender_user_id === currentUserId;
                  return (
                    <div key={message.id} className={`flex items-center gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`w-fit max-w-[78%] rounded-2xl border px-2.5 py-1.5 text-[13px] font-medium leading-[1.05rem] shadow-sm sm:max-w-[64%] sm:px-3 sm:text-[11.5px] sm:font-normal sm:leading-[1.05rem] ${mine ? "border-[#2296E8]/20 bg-[#F1F8FE] text-[#0F2D8F]" : "border-slate-300 bg-white text-slate-900"}`}>
                        <p className="whitespace-pre-wrap break-words leading-[1.05rem] sm:leading-[1.2rem] sm:text-black">{message.body}</p>
                        <span className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] font-medium leading-4 sm:text-[8px] ${mine ? "text-[#0F2D8F]/75 sm:text-[#0F2D8F]" : "text-[#0F2D8F]/70"}`}>
                          {message.edited_at ? <span>Editada</span> : null}
                          <span>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.created_at))}</span>
                          {mine ? <span title={message.read_at ? "Lida" : "Enviada"} className={message.read_at ? "font-bold text-[#0F2D8F]" : ""}>{message.read_at ? "✓✓" : "✓"}</span> : null}
                        </span>
                      </div>
                      {mine ? (
                        <div className="relative block">
                          <button
                            type="button"
                            onClick={() => setActiveMessageMenu((value) => value === message.id ? null : message.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-[#0F2D8F]/65 hover:bg-blue-50 hover:text-[#0F2D8F] sm:h-7 sm:w-7"
                            aria-label="Opções da mensagem"
                            disabled={messageAction === message.id}
                          >
                            ⋯
                          </button>
                          {activeMessageMenu === message.id ? (
                            <div className="absolute right-0 top-8 z-10 w-28 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                              <button type="button" onClick={() => startEditingMessage(message)} className="block w-full px-3 py-2 text-left text-xs font-medium text-[#0F2D8F] hover:bg-blue-50">Editar</button>
                              <button type="button" onClick={() => void removeMessage(message)} className="block w-full px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50">Excluir</button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div data-chat-footer className="shrink-0 border-t border-slate-200 bg-white p-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] sm:p-3">
            {error ? <p className="mb-2 text-xs font-medium text-red-600">{error}</p> : null}
            {editingMessage ? (
              <div className="mb-2 flex items-center justify-between rounded-xl border-l-4 border-[#2296E8] bg-blue-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#0F2D8F]">Editando mensagem</p>
                  <p className="truncate text-xs text-slate-600">{editingMessage.body}</p>
                </div>
                <button type="button" onClick={() => { setEditingMessage(null); setDraft(""); }} className="ml-2 rounded-lg px-2 py-1 text-xs font-medium text-[#0F2D8F] hover:bg-white">Cancelar</button>
              </div>
            ) : null}
            <div data-chat-composer className="flex min-w-0 items-end gap-1.5 overflow-hidden rounded-xl border border-[#2296E8]/30 bg-white p-1.5 shadow-sm focus-within:border-[#2296E8] sm:gap-2 sm:rounded-2xl sm:p-2">
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }} rows={1} maxLength={4000} placeholder={contact ? `Mensagem para ${contact.name}` : "Selecione uma conversa"} className="max-h-24 min-h-9 min-w-0 flex-1 resize-none bg-white px-2 py-2 text-[12px] font-normal leading-4 text-[#0F2D8F] caret-[#0F2D8F] outline-none placeholder:text-[#0F2D8F]/45 sm:max-h-28 sm:min-h-10 sm:text-[11.5px] sm:leading-4 sm:text-black sm:caret-black sm:placeholder:text-black/45" />
              <button type="button" disabled={!selected || !draft.trim() || sending} onClick={() => void sendMessage()} className="min-h-9 shrink-0 rounded-xl bg-[#2296E8] px-3 text-[12px] font-semibold text-white disabled:opacity-40 sm:min-h-10 sm:px-4 sm:text-sm">{editingMessage ? "Salvar" : "Enviar"}</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
