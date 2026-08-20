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
const card="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md";

export default function DashboardOverviewClient({modules,motoristaControle,espacoEquipeControle,showSummaryCards}:Props){
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
 const urgent=[s.urgentes,s.solicitacoes,s.equipe,s.leadsAtrasados].every(v=>v!==null)?(s.urgentes??0)+(s.solicitacoes??0)+(s.equipe??0)+(s.leadsAtrasados??0):null;
 const quick: QuickItem[]=[];
 if(allowed.has("agenda"))quick.push(["Agenda","/agenda","▣",null]);
 if(allowed.has("reunioes"))quick.push(["Reuniões","/dashboard/reunioes","👥",s.reunioes]);
 if(allowed.has("motorista"))quick.push(["Motorista",motoristaControle?"/dashboard/motorista":"/dashboard/motorista-leitura","▣",s.motorista]);
 if(allowed.has("compras"))quick.push(["Compras","/dashboard/compras","🛒",s.compras]);
 if(allowed.has("estoque"))quick.push(["Estoque","/dashboard/estoque","◇",s.solicitacoes]);
 if(allowed.has("conferencia"))quick.push(["Conferência","/dashboard/conferencia-pedidos","▤",null]);
 if(espacoEquipeControle)quick.push(["Espaço Equipe","/espaco-equipe","👥",s.equipe]);
 if(allowed.has("leads"))quick.push(["Leads","/dashboard/leads","🎯",s.leads]);
 return <div className="space-y-6">
  {showSummaryCards&&<section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
   <div className={card}><p className="font-semibold text-slate-800">Pendências urgentes</p><p className="mt-3 text-3xl font-bold text-red-600">{metric(urgent)}</p><p className="mt-3 text-xs text-slate-500">Itens que precisam de ação</p></div>
   <Link href="/agenda" className={card}><p className="font-semibold text-slate-800">Compromissos próximos</p><p className="mt-3 text-3xl font-bold text-amber-500">{metric(s.agenda)}</p><p className="mt-3 text-xs text-slate-500">Ver agenda →</p></Link>
   <Link href={motoristaControle?"/dashboard/motorista":"/dashboard/motorista-leitura"} className={card}><p className="font-semibold text-slate-800">Viagens hoje</p><p className="mt-3 text-3xl font-bold text-emerald-600">{metric(s.motorista)}</p><p className="mt-3 text-xs text-slate-500">Ver motorista →</p></Link>
   <Link href="/dashboard/estoque" className={card}><p className="font-semibold text-slate-800">Pedidos a caminho</p><p className="mt-3 text-3xl font-bold text-blue-600">{metric(s.estoque)}</p><p className="mt-3 text-xs text-slate-500">Ver estoque →</p></Link>
  </section>}
  <section><h2 className="mb-3 text-sm font-semibold text-slate-800">Acesso rápido aos módulos</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">{quick.map(([name,href,icon,count])=><Link key={name} href={href} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:shadow-md"><span className="text-lg">{icon}</span><span className="flex-1 text-sm font-semibold text-slate-800">{name}</span>{count!==null&&count!==undefined&&<span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{metric(count)}</span>}<span className="text-slate-400">›</span></Link>)}</div></section>
  {allowed.has("leads")&&<section><h2 className="mb-3 text-sm font-semibold text-slate-700">O que precisa da sua atenção agora.</h2><Link href="/dashboard/leads" className="block rounded-2xl border border-red-200 bg-red-50 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="font-bold uppercase text-red-700">Leads · Follow-up</p><p className="mt-2 text-sm font-semibold text-slate-800">{metric(s.leadsAtrasados)} contatos atrasados &nbsp; | &nbsp; {metric(s.leadsHoje)} contatos para hoje</p></div><span className="rounded-full bg-red-500 px-3 py-1 text-sm font-bold text-white">{metric(s.leads)}</span></div></Link></section>}
  <p className="text-right text-xs text-slate-400">Atualização automática a cada minuto</p>
 </div>
}
