"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PortalIcon from "@/components/portal-icon";

type NoticeItem = { href: string; label: string };

export default function PortalNotifications({items}:{items:NoticeItem[];showUpdates:boolean}) {
  const agenda=items.find(item=>item.href==="/agenda") ?? items.find(item=>item.href==="/agenda-ct");
  const href=agenda?.href;
  const link=useRef<HTMLAnchorElement>(null);
  const [count,setCount]=useState<number|null>(null);
  const [failed,setFailed]=useState(false);

  useEffect(()=>{
    if(!href) return;
    const controller=new AbortController();
    let pending=false;
    async function refresh() {
      // Desktop and mobile share the header; only the visible bell queries.
      if(document.hidden || !link.current?.getClientRects().length || pending) return;
      pending=true;
      try {
        const response=await fetch("/api/agenda-alerts",{cache:"no-store",signal:controller.signal});
        const data=await response.json();
        if(!response.ok || !Array.isArray(data.events)) throw new Error("Falha ao carregar alertas");
        if(!controller.signal.aborted) {
          const key=href==="/agenda"?"principal":"timoni";
          setCount(data.events.filter((event:{calendarKey:string})=>event.calendarKey===key).length);
          setFailed(false);
        }
      } catch {
        if(!controller.signal.aborted) {setCount(null);setFailed(true);}
      } finally {pending=false;}
    }
    void refresh();
    const timer=window.setInterval(()=>void refresh(),60_000);
    const onVisible=()=>void refresh();
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("resize",onVisible);
    return ()=>{controller.abort();window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible);window.removeEventListener("resize",onVisible);};
  },[href]);

  const label=agenda ? `Abrir ${agenda.label}${count ? `: ${count} compromisso${count===1?"":"s"} em alerta` : ""}` : "Nenhuma agenda liberada para este acesso";
  const icon=<><PortalIcon name="bell" className="h-5 w-5"/>{count!==null&&count>0 ? <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[.62rem] font-bold leading-4 text-white">{count>99?"99+":count}</span> : null}</>;
  const className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/10";
  return href
    ? <Link ref={link} href={href} prefetch={false} className={className} aria-label={label} title={failed ? `${label} — não foi possível atualizar o contador` : `${label}. Em andamento ou com início nas próximas 2 horas.`}>{icon}</Link>
    : <span className={className} aria-label={label} title={label}>{icon}</span>;
}
