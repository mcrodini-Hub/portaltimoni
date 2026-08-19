"use client";

import { useEffect, useMemo, useState } from "react";

type Lead = { row:number; cliente:string; segmento:string; contato:string; canal:string; ultimoContato:string; proximoContato:string; observacoes:string; status:"atrasado"|"hoje"|"proximo"|"sem-data" };
type ResponseData = { leads: Lead[]; summary: { atrasados:number; hoje:number; semData:number; pendentes:number } };

export default function LeadsPage() {
  const [data,setData]=useState<ResponseData|null>(null);
  const [filter,setFilter]=useState("pendentes");
  const [editing,setEditing]=useState<Lead|null>(null);
  const [saving,setSaving]=useState(false);

  async function load(){ const r=await fetch("/api/leads",{cache:"no-store"}); if(r.ok) setData(await r.json()); }
  useEffect(()=>{ void load(); },[]);
  const leads=useMemo(()=>{ const all=data?.leads??[]; if(filter==="pendentes") return all.filter(x=>x.status==="atrasado"||x.status==="hoje"); if(filter==="atrasado") return all.filter(x=>x.status==="atrasado"); if(filter==="hoje") return all.filter(x=>x.status==="hoje"); if(filter==="sem-data") return all.filter(x=>x.status==="sem-data"); return all; },[data,filter]);

  async function save(e:React.FormEvent<HTMLFormElement>){ e.preventDefault(); if(!editing)return; setSaving(true); const fd=new FormData(e.currentTarget); const r=await fetch("/api/leads",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({row:editing.row,ultimoContato:fd.get("ultimoContato"),proximoContato:fd.get("proximoContato"),observacoes:fd.get("observacoes")})}); setSaving(false); if(r.ok){setEditing(null); await load();} else alert((await r.json()).error??"Erro ao salvar"); }

  const badge=(s:Lead["status"])=> s==="atrasado"?"bg-red-100 text-red-700":s==="hoje"?"bg-amber-100 text-amber-800":s==="sem-data"?"bg-slate-100 text-slate-600":"bg-emerald-50 text-emerald-700";
  return <div className="pb-8">
    <div className="mb-5"><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-blue-700">Casa Timoni</p><h1 className="text-2xl font-semibold text-slate-950">Leads · Follow-up</h1><p className="mt-1 text-sm text-slate-600">Primeiro o que precisa de contato. Simples e sem perder prazo.</p></div>
    <section className="grid gap-3 sm:grid-cols-4">
      <button onClick={()=>setFilter("pendentes")} className="rounded-2xl border border-red-200 bg-red-50 p-4 text-left"><b className="text-3xl">{data?.summary.pendentes??"—"}</b><p className="text-xs">para agir hoje</p></button>
      <button onClick={()=>setFilter("atrasado")} className="rounded-2xl border p-4 text-left"><b className="text-3xl">{data?.summary.atrasados??"—"}</b><p className="text-xs">atrasados</p></button>
      <button onClick={()=>setFilter("hoje")} className="rounded-2xl border p-4 text-left"><b className="text-3xl">{data?.summary.hoje??"—"}</b><p className="text-xs">para hoje</p></button>
      <button onClick={()=>setFilter("sem-data")} className="rounded-2xl border p-4 text-left"><b className="text-3xl">{data?.summary.semData??"—"}</b><p className="text-xs">sem próxima data</p></button>
    </section>
    <div className="mt-4 flex justify-between"><h2 className="font-semibold">Follow-ups</h2><button onClick={()=>setFilter("todos")} className="text-sm font-semibold text-blue-700">Ver todos</button></div>
    <div className="mt-2 overflow-x-auto rounded-2xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-600"><tr>{["Cliente","Segmento","Contato","Último","Próximo","Observações",""] .map(x=><th key={x} className="px-3 py-3">{x}</th>)}</tr></thead><tbody>{leads.map(x=><tr key={x.row} className="border-t"><td className="px-3 py-3 font-semibold">{x.cliente}</td><td className="px-3 py-3">{x.segmento||"—"}</td><td className="px-3 py-3"><div>{x.contato}</div><div className="text-xs text-slate-500">{x.canal}</div></td><td className="px-3 py-3">{x.ultimoContato||"—"}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge(x.status)}`}>{x.proximoContato||"SEM DATA"}</span></td><td className="max-w-xs px-3 py-3 text-xs text-slate-600">{x.observacoes}</td><td className="px-3 py-3"><button onClick={()=>setEditing(x)} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Registrar contato</button></td></tr>)}</tbody></table></div>
    {editing&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><form onSubmit={save} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"><h3 className="text-lg font-semibold">{editing.cliente}</h3><p className="mb-4 text-sm text-slate-500">Registre o contato e já deixe o próximo programado.</p><label className="text-xs font-semibold">Data do contato</label><input name="ultimoContato" type="date" defaultValue={new Date().toISOString().slice(0,10)} className="mb-3 mt-1 w-full rounded-lg border p-2"/><label className="text-xs font-semibold">Próximo contato *</label><input name="proximoContato" type="date" required className="mb-3 mt-1 w-full rounded-lg border p-2"/><label className="text-xs font-semibold">Observações</label><textarea name="observacoes" defaultValue={editing.observacoes} rows={4} className="mt-1 w-full rounded-lg border p-2"/><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={()=>setEditing(null)} className="rounded-lg border px-4 py-2">Cancelar</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{saving?"Salvando...":"Salvar"}</button></div></form></div>}
  </div>;
}
