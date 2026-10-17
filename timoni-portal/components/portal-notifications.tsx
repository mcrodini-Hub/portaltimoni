"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import PortalIcon from "@/components/portal-icon";
import { useModuleUpdates } from "@/components/module-updates-store";
import type { UpdateModule } from "@/lib/module-updates";

type NoticeItem = { href: string; label: string; updateModule?: UpdateModule };
type AlertEvent = { id: string; summary: string; start: string; calendarKey: "principal" | "timoni"; calendarLabel: string };

export default function PortalNotifications({items,showUpdates}:{items:NoticeItem[];showUpdates:boolean}) {
  const [open,setOpen]=useState(false);
  const {updates,markRead}=useModuleUpdates(showUpdates);
  const pending=showUpdates ? items.filter(item=>item.updateModule && updates[item.updateModule]) : [];
  const total=pending.reduce((sum,item)=>sum+(updates[item.updateModule!]?.count || 0),0);
  return <>
    <button type="button" onClick={()=>setOpen(true)} className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/10" aria-label={total ? `Abrir notificações: ${total} atualizações` : "Abrir notificações"} aria-haspopup="dialog" aria-expanded={open}>
      <PortalIcon name="bell" className="h-5 w-5"/>
      {total>0 ? <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[.62rem] font-bold leading-4 text-white">{total>99?"99+":total}</span> : null}
    </button>
    {open ? <NotificationsDialog items={pending.map(item=>({...item,count:updates[item.updateModule!].count}))} onRead={module=>void markRead(module)} onClose={()=>setOpen(false)}/> : null}
  </>;
}

function NotificationsDialog({items,onRead,onClose}:{items:Array<NoticeItem & {count:number}>;onRead:(module:UpdateModule)=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [events,setEvents]=useState<AlertEvent[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const element=dialog.current;
    const previousFocus=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    const overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{element?.close();document.body.style.overflow=overflow;previousFocus?.focus();};
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError("");
    void (async()=>{
      try {
        const response=await fetch("/api/agenda-alerts",{cache:"no-store",signal:controller.signal});
        const data=await response.json();
        if(!response.ok) throw new Error(data.error || "Não foi possível carregar os alertas.");
        if(!controller.signal.aborted) setEvents(data.events || []);
      } catch(cause) {
        if(!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os alertas.");
      } finally { if(!controller.signal.aborted) setLoading(false); }
    })();
    return ()=>controller.abort();
  },[attempt]);
  return createPortal(<dialog ref={dialog} onCancel={onClose} onClick={event=>{if(event.target===dialog.current)onClose();}} aria-labelledby="portal-notifications-title" className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-950/45">
    <div className="flex items-center justify-between gap-3"><h2 id="portal-notifications-title" className="text-lg font-semibold text-[#13038D]">Notificações</h2><button type="button" onClick={onClose} aria-label="Fechar notificações" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100"><PortalIcon name="close" className="h-5 w-5"/></button></div>
    <h3 className="mt-4 font-semibold">Compromissos em alerta{!loading&&!error ? ` (${events.length})` : ""}</h3>
    <p className="mt-1 text-sm text-slate-500">Em andamento ou com início nas próximas 2 horas.</p>
    <div className="mt-3 space-y-3" aria-live="polite" aria-busy={loading}>
      {loading ? <p className="text-sm text-slate-500">Carregando compromissos…</p> : error ? <div><p role="alert" className="text-sm text-red-700">{error}</p><button type="button" onClick={()=>setAttempt(value=>value+1)} className="mt-2 text-sm font-semibold text-[#13038D]">Tentar novamente</button></div> : events.length ? events.map(event=><article key={`${event.calendarKey}-${event.id}`} className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="break-words font-semibold">{event.summary}</p><p className="mt-1 text-sm text-slate-600">{event.calendarKey==="principal"?"Agenda Ciça":"Agenda CT"} · {new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",...(event.start.includes("T")?{hour:"2-digit",minute:"2-digit"}:{})}).format(new Date(event.start.includes("T")?event.start:`${event.start}T12:00:00-03:00`))}</p><Link href={event.calendarKey==="principal"?"/agenda":"/agenda-ct"} onClick={onClose} className="mt-2 inline-block text-sm font-semibold text-[#13038D]">Ver na agenda</Link></article>) : <p className="text-sm text-slate-500">Nenhum compromisso em alerta.</p>}
    </div>
    {items.length ? <section className="mt-5 border-t border-slate-200 pt-4"><h3 className="font-semibold">Atualizações por módulo</h3><div className="mt-2 space-y-2">{items.map(item=><Link key={item.href} href={item.href} onClick={()=>{if(item.updateModule)onRead(item.updateModule);onClose();}} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm"><span>{item.label}</span><span className="font-semibold text-[#D40C0D]">{item.count} {item.count===1?"atualização":"atualizações"}</span></Link>)}</div></section> : null}
  </dialog>,document.body);
}
