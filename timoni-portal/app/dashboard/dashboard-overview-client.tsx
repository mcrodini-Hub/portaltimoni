"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ModuleItem = { module: string; name: string; href: string; icon: string; accent: string };
type Props = { modules: ModuleItem[]; motoristaControle: boolean; espacoEquipeControle: boolean; showSummaryCards: boolean };
type NotificationItem = { type?: string };
type StockOrder = { situacao?: string };
type MeetingItem = { status?: string; date?: string; secondDate?: string };
type QuickItem = [name: string, href: string, icon: string, count: number | null];
type Snapshot = { compras:number|null; urgentes:number|null; estoque:number|null; solicitacoes:number|null; agenda:number|null; motorista:number|null; equipe:number|null; leads:number|null; leadsAtrasados:number|null; leadsHoje:number|null; reunioes:number|null };
const empty: Snapshot = { compras:null, urgentes:null, estoque:null, solicitacoes:null, agenda:null, motorista:null, equipe:null, leads:null, leadsAtrasados:null, leadsHoje:null, reunioes:null };
const metric=(v:number|null)=>v===null?"—":String(v);
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};

export default function DashboardOverviewClient({modules,motoristaControle,espacoEquipeControle}:Props){
 const [s,setS]=useState<Snapshot>(empty); const allowed=useMemo(()=>new Set(modules.map(x=>x.module)),[modules]);
 useEffect(()=>{let off=false; async function load(){const start=new Date();start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+7);end.setHours(23,59,59,999);const today=localDate();const reqs=[
  allowed.has("compras")?fetch("/api/compras",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()):null,
  allowed.has("painel")?fetch("/api/painel-notifications",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()):null,
  allowed.has("agenda")?fetch(`/api/events?timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}`,{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()):null,
  allowed.has("estoque")?fetch("/api/estoque",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()):null,
  allowed.has("motorista")?fetch(`/api/motorista-leitura?action=dia&data=${today}`,{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()):null,
  espacoEquipeControle?fetch("/api/espaco-equipe",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()):null,
  allowed.has("leads")?fetch("/api/leads",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()):null,
  allowed.has("reunioes")?fetch("/api/reunioes",{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()):null
 ]; const a=await Promise.allSettled(reqs); if(off)return; const n={...empty};
  if(a[0].status==="fulfilled"&&a[0].value){n.compras=a[0].value.summary?.pedidosParaFazer??0;n.urgentes=a[0].value.summary?.urgentes??0}
  if(a[1].status==="fulfilled"&&a[1].value)n.solicitacoes=(a[1].value.items??[]).filter((x: NotificationItem)=>x.type==="estoque").length;
  if(a[2].status==="fulfilled"&&a[2].value)n.agenda=(a[2].value.events??[]).length;
  if(a[3].status==="fulfilled"&&a[3].value)n.estoque=(a[3].value.pedidosEnviados??[]).filter((x: StockOrder)=>x.situacao==="enviado").length;
  if(a[4].status==="fulfilled"&&a[4].value)n.motorista=(a[4].value.viagens??[]).length;
  if(a[5].status==="fulfilled"&&a[5].value)n.equipe=a[5].value.pending??0;
  if(a[6].status==="fulfilled"&&a[6].value){n.leads=a[6].value.summary?.pendentes??0;n.leadsAtrasados=a[6].value.summary?.atrasados??0;n.leadsHoje=a[6].value.summary?.hoje??0}
  if(a[7].status==="fulfilled"&&a[7].value){const items=a[7].value.items??[];n.reunioes=items.filter((x: MeetingItem)=>x.status!=="concluida").reduce((total:number,x: MeetingItem)=>total+(x.date&&x.date>=today?1:0)+(x.secondDate&&x.secondDate>=today?1:0),0)}
  setS(n);
 } void load();const id=setInterval(load,60000);return()=>{off=true;clearInterval(id)}},[allowed,espacoEquipeControle]);
 const quick: QuickItem[]=[];
 if(allowed.has("compras"))quick.push(["Compras","/dashboard/compras","🛒",s.compras]);
 if(allowed.has("motorista"))quick.push(["Motorista",motoristaControle?"/dashboard/motorista":"/dashboard/motorista-leitura","▣",s.motorista]);
 if(allowed.has("agenda"))quick.push(["Agenda","/agenda","▣",s.agenda]);
 if(allowed.has("leads"))quick.push(["Leads","/dashboard/leads","🎯",s.leads]);
 if(allowed.has("estoque"))quick.push(["Estoque","/dashboard/estoque","◇",s.solicitacoes]);
 return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{quick.map(([name,href,icon,count])=><Link key={name} href={href} className="flex min-h-36 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between"><span className="text-2xl">{icon}</span><span className="text-slate-400">›</span></div><div className="mt-5"><p className="text-base font-semibold text-slate-800">{name}</p>{count!==null&&count!==undefined&&<p className="mt-2 text-3xl font-bold text-[#0b1f5e]">{metric(count)}</p>}</div></Link>)}</div>
}
