"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

type Lead = { row:number; cliente:string; segmento:string; contato:string; canal:string; ultimoContato:string; proximoContato:string; observacoes:string; status:"atrasado"|"hoje"|"proximo"|"sem-data" };
type Prospect = { id:string; cliente:string; segmento:string; cidade:string; contato:string; canal:string; oportunidade:string; observacoes:string; origem:"historico"|"portal" };
type ResponseData = { leads: Lead[]; prospects: Prospect[]; summary: { atrasados:number; hoje:number; semData:number; pendentes:number; prospectar:number } };
type ImportRow = { cliente:string; segmento:string; contato:string; canal:string; ultimoContato:string; proximoContato:string; observacoes:string; sourceRow:number; duplicate?:boolean; error?:string };

const normalizeHeader=(value:unknown)=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g,"");
const normalizeImportDate=(value:string)=>{
  const match=value.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if(!match)return value;
  const year=match[3].length===2?`20${match[3]}`:match[3];
  return `${match[1].padStart(2,"0")}/${match[2].padStart(2,"0")}/${year}`;
};
const headerAliases:Record<Exclude<keyof ImportRow,"sourceRow"|"duplicate"|"error">,string[]>={
  cliente:["cliente","empresa","razaosocial","nomefantasia"], segmento:["segmento","ramo","atividade"], contato:["contato","pessoa","responsavel"],
  canal:["canal","telefone","email","telefoneemail","whatsapp","whatsappemail"], ultimoContato:["ultimocontato","dataultimocontato","datadocontato"],
  proximoContato:["proximocontato","dataproximocontato","datadoproximocontato","retorno"], observacoes:["observacoes","observacao","observacoesperiocidadeprodutosetc","observacoesperiodicidadeprodutosetc","notas"],
};

export default function LeadsPage() {
  const [data,setData]=useState<ResponseData|null>(null);
  const [filter,setFilter]=useState("pendentes");
  const [tab,setTab]=useState<"followup"|"prospectar">("followup");
  const [editing,setEditing]=useState<Lead|null>(null);
  const [saving,setSaving]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [showSearch,setShowSearch]=useState(false);
  const [text,setText]=useState("");
  const [segment,setSegment]=useState("");
  const fileInputRef=useRef<HTMLInputElement>(null);
  const [importRows,setImportRows]=useState<ImportRow[]|null>(null);
  const [importName,setImportName]=useState("");
  const [importError,setImportError]=useState("");

  async function load(){ const r=await fetch("/api/leads",{cache:"no-store"}); if(r.ok) setData(await r.json()); }
  useEffect(()=>{ void load(); },[]);

  const segments=useMemo(()=>Array.from(new Set((data?.leads??[]).map(x=>x.segmento).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"pt-BR")),[data]);
  const leads=useMemo(()=>{ let all=data?.leads??[]; if(filter==="pendentes") all=all.filter(x=>x.status==="atrasado"||x.status==="hoje"); else if(filter!=="todos") all=all.filter(x=>x.status===filter); if(segment) all=all.filter(x=>x.segmento===segment); const q=text.trim().toLocaleLowerCase("pt-BR"); if(q) all=all.filter(x=>`${x.cliente} ${x.segmento} ${x.contato} ${x.canal} ${x.observacoes}`.toLocaleLowerCase("pt-BR").includes(q)); return all; },[data,filter,segment,text]);
  const prospects=useMemo(()=>{ const q=text.trim().toLocaleLowerCase("pt-BR"); return (data?.prospects??[]).filter(x=>!q||`${x.cliente} ${x.segmento} ${x.cidade} ${x.oportunidade} ${x.observacoes}`.toLocaleLowerCase("pt-BR").includes(q)); },[data,text]);

  async function saveFollowup(e:React.FormEvent<HTMLFormElement>){ e.preventDefault(); if(!editing)return; setSaving(true); const fd=new FormData(e.currentTarget); const r=await fetch("/api/leads",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({row:editing.row,ultimoContato:fd.get("ultimoContato"),proximoContato:fd.get("proximoContato"),observacoes:fd.get("observacoes")})}); setSaving(false); if(r.ok){setEditing(null); await load();} else alert((await r.json()).error??"Erro ao salvar"); }
  async function createLead(e:React.FormEvent<HTMLFormElement>){ e.preventDefault(); setSaving(true); const fd=new FormData(e.currentTarget); const payload=Object.fromEntries(fd.entries()); const r=await fetch("/api/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}); setSaving(false); if(r.ok){setShowForm(false); await load();} else alert((await r.json()).error??"Erro ao cadastrar"); }
  async function readImportFile(file:File){
    setImportError("");
    try {
      const workbook=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:false});
      const sheet=workbook.Sheets[workbook.SheetNames[0]];
      const matrix=XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:"",raw:false});
      if(matrix.length<2) throw new Error("O arquivo está vazio ou não possui linhas de dados.");
      const headers=(matrix[0]??[]).map(normalizeHeader);
      const indexes=Object.fromEntries(Object.entries(headerAliases).map(([field,aliases])=>[field,headers.findIndex(h=>aliases.includes(h))])) as Record<string,number>;
      if(indexes.cliente<0) throw new Error("Não encontrei a coluna Empresa ou Cliente.");
      const existing=new Set([...(data?.leads??[]),...(data?.prospects??[])].map(x=>x.cliente.trim().toLocaleLowerCase("pt-BR")));
      const seen=new Set<string>();
      const value=(row:unknown[],field:string)=>indexes[field]>=0?String(row[indexes[field]]??"").trim():"";
      const parsed=matrix.slice(1).map((raw,index)=>{
        const row=Array.isArray(raw)?raw:[];
        const cliente=value(row,"cliente");
        const key=cliente.toLocaleLowerCase("pt-BR");
        const duplicate=Boolean(cliente)&&(existing.has(key)||seen.has(key));
        if(cliente&&!duplicate) seen.add(key);
        return {cliente,segmento:value(row,"segmento"),contato:value(row,"contato"),canal:value(row,"canal"),ultimoContato:normalizeImportDate(value(row,"ultimoContato")),proximoContato:normalizeImportDate(value(row,"proximoContato")),observacoes:value(row,"observacoes"),sourceRow:index+2,duplicate,error:cliente?undefined:"Empresa não informada"};
      }).filter(row=>Object.values(row).some(value=>typeof value==="string"&&value.trim()));
      if(!parsed.length) throw new Error("O arquivo não possui registros preenchidos.");
      setImportName(file.name); setImportRows(parsed);
    } catch(error) { setImportRows(null); setImportError(error instanceof Error?error.message:"Não foi possível ler o arquivo."); }
    finally { if(fileInputRef.current) fileInputRef.current.value=""; }
  }
  async function confirmImport(){
    if(!importRows)return;
    const valid=importRows.filter(row=>!row.duplicate&&!row.error).map(row=>({cliente:row.cliente,segmento:row.segmento,contato:row.contato,canal:row.canal,ultimoContato:row.ultimoContato,proximoContato:row.proximoContato,observacoes:row.observacoes}));
    if(!valid.length)return;
    setSaving(true);
    const r=await fetch("/api/leads",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows:valid})});
    const result=await r.json(); setSaving(false);
    if(!r.ok){setImportError(result.error??"Erro ao importar");return;}
    alert(`${result.imported} empresa(s) importada(s) para Follow-up.`); setImportRows(null); setImportName(""); await load();
  }
  function googleSearch(e:React.FormEvent<HTMLFormElement>){ e.preventDefault(); const fd=new FormData(e.currentTarget); const segmento=String(fd.get("segmento")??"").trim(); const regiao=String(fd.get("regiao")??"").trim(); const oportunidade=String(fd.get("oportunidade")??"").trim(); const query=[segmento,regiao,oportunidade].filter(Boolean).join(" "); if(!query) return; window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`,"_blank","noopener,noreferrer"); window.open(`https://www.google.com/maps/search/${encodeURIComponent([segmento,regiao].filter(Boolean).join(" "))}`,"_blank","noopener,noreferrer"); }

  const badge=(s:Lead["status"])=> s==="atrasado"?"bg-red-100 text-red-700":s==="hoje"?"bg-amber-100 text-amber-800":s==="sem-data"?"bg-slate-100 text-slate-600":"bg-emerald-50 text-emerald-700";
  return <div className="pb-8">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-blue-700">Casa Timoni</p><h1 className="text-2xl font-semibold text-slate-950">Leads</h1><p className="mt-1 text-sm text-slate-600">Follow-up e prospecção sem complicação.</p></div><div className="flex flex-wrap gap-2"><input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)void readImportFile(file)}}/><button onClick={()=>fileInputRef.current?.click()} className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700">Importar arquivo</button><button onClick={()=>setShowSearch(true)} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">Buscar empresas</button><button onClick={()=>setShowForm(true)} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white">+ Cadastrar</button></div></div>
    {importError&&!importRows&&<div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{importError}</div>}

    <section className="grid gap-3 sm:grid-cols-5">
      <button onClick={()=>{setTab("followup");setFilter("pendentes")}} className="rounded-2xl border border-red-200 bg-red-50 p-4 text-left"><b className="text-3xl">{data?.summary.pendentes??"—"}</b><p className="text-xs">para agir hoje</p></button>
      <button onClick={()=>{setTab("followup");setFilter("atrasado")}} className="rounded-2xl border p-4 text-left"><b className="text-3xl">{data?.summary.atrasados??"—"}</b><p className="text-xs">atrasados</p></button>
      <button onClick={()=>{setTab("followup");setFilter("hoje")}} className="rounded-2xl border p-4 text-left"><b className="text-3xl">{data?.summary.hoje??"—"}</b><p className="text-xs">para hoje</p></button>
      <button onClick={()=>{setTab("followup");setFilter("sem-data")}} className="rounded-2xl border p-4 text-left"><b className="text-3xl">{data?.summary.semData??"—"}</b><p className="text-xs">sem próxima data</p></button>
      <button onClick={()=>setTab("prospectar")} className="rounded-2xl border p-4 text-left"><b className="text-3xl">{data?.summary.prospectar??"—"}</b><p className="text-xs">a prospectar</p></button>
    </section>

    <div className="mt-5 flex flex-wrap gap-2"><button onClick={()=>setTab("followup")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab==="followup"?"bg-slate-900 text-white":"border bg-white"}`}>Follow-up</button><button onClick={()=>setTab("prospectar")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab==="prospectar"?"bg-slate-900 text-white":"border bg-white"}`}>A prospectar</button></div>
    <div className="mt-3 flex flex-wrap gap-2"><input value={text} onChange={e=>setText(e.target.value)} placeholder="Buscar empresa, contato, produto..." className="min-w-72 flex-1 rounded-xl border bg-white px-3 py-2 text-sm"/>{tab==="followup"&&<select value={segment} onChange={e=>setSegment(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm"><option value="">Todos os segmentos</option>{segments.map(x=><option key={x}>{x}</option>)}</select>}{tab==="followup"&&<button onClick={()=>setFilter("todos")} className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold">Ver todos</button>}</div>

    {tab==="followup"?<div className="mt-3 overflow-x-auto rounded-2xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-600"><tr>{["Cliente","Segmento","Contato","Último","Próximo","Observações",""] .map(x=><th key={x} className="px-3 py-3">{x}</th>)}</tr></thead><tbody>{leads.map(x=><tr key={x.row} className="border-t"><td className="px-3 py-3 font-semibold">{x.cliente}</td><td className="px-3 py-3">{x.segmento||"—"}</td><td className="px-3 py-3"><div>{x.contato||"—"}</div><div className="text-xs text-slate-500">{x.canal}</div></td><td className="px-3 py-3">{x.ultimoContato||"—"}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge(x.status)}`}>{x.proximoContato||"SEM DATA"}</span></td><td className="max-w-xs px-3 py-3 text-xs text-slate-600">{x.observacoes}</td><td className="px-3 py-3"><button onClick={()=>setEditing(x)} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Registrar contato</button></td></tr>)}</tbody></table></div>
    :<div className="mt-3 overflow-x-auto rounded-2xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-600"><tr>{["Empresa","Segmento","Cidade/Região","Contato","Oportunidade","Observações"].map(x=><th key={x} className="px-3 py-3">{x}</th>)}</tr></thead><tbody>{prospects.map(x=><tr key={x.id} className="border-t"><td className="px-3 py-3 font-semibold">{x.cliente}</td><td className="px-3 py-3">{x.segmento||"—"}</td><td className="px-3 py-3">{x.cidade||"—"}</td><td className="px-3 py-3"><div>{x.contato||"—"}</div><div className="text-xs text-slate-500">{x.canal}</div></td><td className="px-3 py-3">{x.oportunidade||"—"}</td><td className="max-w-sm px-3 py-3 text-xs text-slate-600">{x.observacoes}</td></tr>)}</tbody></table></div>}

    {showSearch&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><form onSubmit={googleSearch} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"><h3 className="text-lg font-semibold">Buscar empresas</h3><p className="mb-4 text-sm text-slate-500">A busca abre Google e Google Maps. Depois, cadastre apenas o que fizer sentido.</p><label className="text-xs font-semibold">Segmento *</label><input name="segmento" required className="mb-3 mt-1 w-full rounded-lg border p-2" placeholder="Ex.: cerâmica, transportadora"/><label className="text-xs font-semibold">Cidade/região *</label><input name="regiao" required className="mb-3 mt-1 w-full rounded-lg border p-2" placeholder="Ex.: Rio Claro SP"/><label className="text-xs font-semibold">Produto/demanda</label><input name="oportunidade" className="mt-1 w-full rounded-lg border p-2" placeholder="Ex.: plástico bolha"/><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={()=>setShowSearch(false)} className="rounded-lg border px-4 py-2">Cancelar</button><button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">Buscar</button></div></form></div>}

    {importRows&&<div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-2 sm:items-center sm:p-4"><div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)]"><div className="shrink-0 border-b p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Prévia da importação</h3><p className="break-all text-sm text-slate-500">{importName}</p></div><button onClick={()=>{setImportRows(null);setImportName("");setImportError("")}} className="rounded-lg border px-3 py-1 text-lg leading-none" aria-label="Fechar">×</button></div>{importError&&<div className="mt-3 max-h-28 overflow-auto rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{importError}</div>}<div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{importRows.filter(x=>!x.duplicate&&!x.error).length} novos</span><span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">{importRows.filter(x=>x.duplicate).length} duplicados</span><span className="rounded-full bg-red-100 px-3 py-1 text-red-700">{importRows.filter(x=>x.error).length} com erro</span></div></div><div className="min-h-0 flex-1 overflow-auto"><table className="min-w-full text-sm"><thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600"><tr><th className="px-3 py-3">Linha</th><th className="px-3 py-3">Empresa</th><th className="px-3 py-3">Segmento</th><th className="px-3 py-3">Contato</th><th className="px-3 py-3">Situação</th></tr></thead><tbody>{importRows.map(x=><tr key={x.sourceRow} className="border-t"><td className="px-3 py-3">{x.sourceRow}</td><td className="px-3 py-3 font-semibold">{x.cliente||"—"}</td><td className="px-3 py-3">{x.segmento||"—"}</td><td className="px-3 py-3">{x.contato||x.canal||"—"}</td><td className="px-3 py-3">{x.error?<span className="text-red-700">{x.error}</span>:x.duplicate?<span className="text-amber-700">Duplicado — não será importado</span>:<span className="text-emerald-700">Pronto para importar</span>}</td></tr>)}</tbody></table></div><div className="flex shrink-0 flex-wrap justify-end gap-2 border-t bg-white p-3 sm:p-4"><button onClick={()=>{setImportRows(null);setImportName("");setImportError("")}} className="rounded-lg border px-4 py-2">Cancelar</button><button disabled={saving||!importRows.some(x=>!x.duplicate&&!x.error)} onClick={()=>void confirmImport()} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving?"Importando...":`Confirmar importação (${importRows.filter(x=>!x.duplicate&&!x.error).length})`}</button></div></div></div>}

    {showForm&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><form onSubmit={createLead} className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl"><h3 className="text-lg font-semibold">Cadastrar empresa</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label className="text-xs font-semibold">Destino</label><select name="destino" className="mt-1 w-full rounded-lg border p-2"><option value="prospectar">A prospectar</option><option value="followup">Follow-up</option></select></div><div><label className="text-xs font-semibold">Empresa *</label><input name="cliente" required className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Segmento</label><input name="segmento" className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Cidade/região</label><input name="cidade" className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Contato</label><input name="contato" className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Telefone/e-mail</label><input name="canal" className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Produto/oportunidade</label><input name="oportunidade" className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Próximo contato (se Follow-up)</label><input name="proximoContato" type="date" className="mt-1 w-full rounded-lg border p-2"/></div></div><label className="mt-3 block text-xs font-semibold">Observações</label><textarea name="observacoes" rows={3} className="mt-1 w-full rounded-lg border p-2"/><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={()=>setShowForm(false)} className="rounded-lg border px-4 py-2">Cancelar</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{saving?"Salvando...":"Salvar"}</button></div></form></div>}

    {editing&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><form onSubmit={saveFollowup} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"><h3 className="text-lg font-semibold">{editing.cliente}</h3><p className="mb-4 text-sm text-slate-500">Registre o contato e já deixe o próximo programado.</p><label className="text-xs font-semibold">Data do contato</label><input name="ultimoContato" type="date" defaultValue={new Date().toISOString().slice(0,10)} className="mb-3 mt-1 w-full rounded-lg border p-2"/><label className="text-xs font-semibold">Próximo contato *</label><input name="proximoContato" type="date" required className="mb-3 mt-1 w-full rounded-lg border p-2"/><label className="text-xs font-semibold">Observações</label><textarea name="observacoes" defaultValue={editing.observacoes} rows={4} className="mt-1 w-full rounded-lg border p-2"/><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={()=>setEditing(null)} className="rounded-lg border px-4 py-2">Cancelar</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{saving?"Salvando...":"Salvar"}</button></div></form></div>}
  </div>;
}
