"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PortalIcon from "@/components/portal-icon";
type NoticeItem = {href:string; label:string};
export default function PortalNotifications({items}:{items:NoticeItem[];showUpdates:boolean}) {
  const stock = items.find(item => item.href === "/dashboard/estoque");
  const link = useRef<HTMLAnchorElement>(null);
  const [count,setCount] = useState(0);
  const [failed,setFailed] = useState(false);
  const pathname = usePathname();
  const refresh = useCallback(async () => {
    if (!stock || document.hidden || !link.current?.getClientRects().length || pathname === stock.href) return;
    try {
      const response = await fetch("/api/stock-notifications", {cache:"no-store"});
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.ids)) throw new Error();
      setCount(data.ids.length);setFailed(false);
    } catch {setFailed(true);}
  },[stock,pathname]);
  useEffect(()=>{
    let pending=false;
    const run=async()=>{if(pending)return;pending=true;try{await refresh();}finally{pending=false;}};
    void run();
    const timer=window.setInterval(()=>void run(),60000);
    const visible=()=>void run();
    const update=(event:Event)=>{const detail=(event as CustomEvent<{count:number}>).detail;if(detail)setCount(detail.count);};
    document.addEventListener("visibilitychange",visible);
    window.addEventListener("resize",visible);
    window.addEventListener("stock-notices-updated",update);
    return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",visible);window.removeEventListener("resize",visible);window.removeEventListener("stock-notices-updated",update);};
  },[refresh]);
  const label=count ? `Estoque: ${count} necessidade${count===1?"":"s"} nova${count===1?"":"s"}. Abrir Estoque.` : "Abrir Estoque";
  const icon=<><PortalIcon name="bell" className="h-5 w-5"/>{count>0&&<span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[.62rem] font-bold leading-4 text-white">{count>99?"99+":count}</span>}</>;
  const className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/10";
  return stock ? <Link ref={link} href={stock.href+"?novos=1#estoque-etapa-0"} prefetch={false} className={className} aria-label={label} title={failed?label+" — não foi possível atualizar o contador":label}>{icon}<span className="sr-only">Estoque</span></Link> : <span className={className} aria-label="Nenhuma notificação disponível">{icon}</span>;
}
