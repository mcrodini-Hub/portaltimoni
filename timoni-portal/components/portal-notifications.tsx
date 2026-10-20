"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import PortalIcon from "@/components/portal-icon";

type NoticeItem = { href: string; label: string };
type AlertEvent = { id: string; summary: string; start: string; end: string; calendarKey: string; calendarLabel: string };

export default function PortalNotifications({items}:{items:NoticeItem[];showUpdates:boolean}) {
  const agenda=items.find(item=>item.href==="/agenda") ?? items.find(item=>item.href==="/agenda-ct");
  const href=agenda?.href;
  const button=useRef<HTMLButtonElement>(null);
  const closeButton=useRef<HTMLButtonElement>(null);
  const dialog=useRef<HTMLElement>(null);
  const titleId=useId();
  const [events,setEvents]=useState<AlertEvent[]|null>(null);
  const [failed,setFailed]=useState(false);
  const [open,setOpen]=useState(false);

  useEffect(()=>{
    if(!href) return;
    const controller=new AbortController();
    let pending=false;
    async function refresh() {
      // Desktop and mobile share the header; only the visible bell queries.
      if(document.hidden || !button.current?.getClientRects().length || pending) return;
      pending=true;
      try {
        const response=await fetch("/api/agenda-alerts",{cache:"no-store",signal:controller.signal});
        const data=await response.json();
        if(!response.ok || !Array.isArray(data.events)) throw new Error("Falha ao carregar alertas");
        if(!controller.signal.aborted) {
          const key=href==="/agenda"?"principal":"timoni";
          setEvents(data.events.filter((event:AlertEvent)=>event.calendarKey===key));
          setFailed(false);
        }
      } catch {
        if(!controller.signal.aborted) setFailed(true);
      } finally {pending=false;}
    }
    void refresh();
    const timer=window.setInterval(()=>void refresh(),60_000);
    const onVisible=()=>void refresh();
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("resize",onVisible);
    return ()=>{controller.abort();window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);window.removeEventListener("resize",onVisible);};
  },[href]);

  useEffect(()=>{
    if(!open) return;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    closeButton.current?.focus();
    function onKeyDown(event:KeyboardEvent) {
      if(event.key==="Escape") {setOpen(false);return;}
      if(event.key!=="Tab") return;
      const controls=dialog.current?.querySelectorAll<HTMLElement>('button, a[href]');
      if(!controls?.length) return;
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&document.activeElement===first) {event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last) {event.preventDefault();first.focus();}
    }
    document.addEventListener("keydown",onKeyDown);
    return ()=>{document.body.style.overflow=previousOverflow;document.removeEventListener("keydown",onKeyDown);button.current?.focus();};
  },[open]);

  const count=events?.length;
  const label=agenda ? `Abrir alertas de ${agenda.label}${count ? `: ${count} compromisso${count===1?"":"s"} em alerta` : ""}` : "Nenhuma agenda liberada para este acesso";
  const icon=<><PortalIcon name="bell" className="h-5 w-5"/>{count!==undefined&&count>0 ? <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[.62rem] font-bold leading-4 text-white">{count>99?"99+":count}</span> : null}</>;
  const className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/10";
  return <>
    {href ? <button ref={button} type="button" onClick={()=>setOpen(true)} className={className} aria-label={label} aria-haspopup="dialog" aria-expanded={open} title={label}>{icon}</button>
      : <span className={className} aria-label={label} title={label}>{icon}</span>}
    {open&&href&&createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4" onClick={event=>{if(event.target===event.currentTarget)setOpen(false);}}>
        <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white font-sans text-slate-900 shadow-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
            <div><h2 id={titleId} className="text-xl font-bold text-[#13038D]">Compromissos em alerta</h2><p className="mt-1 text-sm text-slate-600">Em andamento ou com início nas próximas 2 horas.</p></div>
            <button ref={closeButton} type="button" onClick={()=>setOpen(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Fechar</button>
          </header>
          <div className="space-y-3 overflow-y-auto p-5">
            {failed&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">Não foi possível atualizar os alertas. Abra a agenda para conferir.{events?.length ? " Exibindo a última consulta." : ""}</p>}
            {events===null&&!failed&&<p role="status">Carregando alertas…</p>}
            {events?.length===0&&<p>Nenhum compromisso em alerta neste momento.</p>}
            {events?.map(event=><article key={event.calendarKey+":"+event.id} className="rounded-xl border-l-4 border-[#D40C0D] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-[#D40C0D]">Compromisso sinalizado</p>
              <h3 className="mt-1 whitespace-pre-wrap break-words text-lg font-bold">{event.summary||"Sem título"}</h3>
              <p className="mt-2 text-sm font-semibold text-[#13038D]">{new Date(event.start).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})} — {new Date(event.end).toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"})}</p>
              <p className="mt-1 text-sm text-slate-600">{event.calendarLabel}</p>
            </article>)}
          </div>
          <footer className="border-t border-slate-200 p-4"><Link href={href} prefetch={false} onClick={()=>setOpen(false)} className="inline-flex rounded-lg bg-[#13038D] px-4 py-2 text-sm font-semibold text-white">Abrir {agenda?.label}</Link></footer>
        </section>
      </div>,document.body)}
  </>;
}
