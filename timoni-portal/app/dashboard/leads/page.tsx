"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

type Lead = { row:number; cliente:string; segmento:string; contato:string; canal:string; ultimoContato:string; proximoContato:string; observacoes:string; status:"atrasado"|"hoje"|"proximo"|"sem-data" };
type Prospect = { id:string; cliente:string; segmento:string; cidade:string; contato:string; canal:string; oportunidade:string; observacoes:string; origem:"historico"|"portal" };
type Activity = { data:string; tipo:"CONTATO"|"CADASTRO"|"REATIVAÇÃO"|"IMPORTAÇÃO"; cliente:string; proximoContato:string; observacoes:string };
type ResponseData = { leads: Lead[]; prospects: Prospect[]; activities:Activity[]; summary: { atrasados:number; hoje:number; semData:number; pendentes:number; prospectar:number } };
type ImportRow = { cliente:string; segmento:string; contato:string; canal:string; ultimoContato:string; proximoContato:string; observacoes:string; sourceRow:number; duplicate?:boolean; error?:string };

const normalizeHeader=(value:unknown)=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g,"");
const normalizeImportDate=(value:string)=>{
  const match=value.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if(!match)return value;
  const year=match[3].length===2?`20${match[3]}`:match[3];
  return `${match[1].padStart(2,"0")}/${match[2].padStart(2,"0")}/${year}`;
};
const toDateInput=(value:string)=>{
  const iso=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(iso)return value;
  const br=value.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if(!br)return "";
  const year=br[3].length===2?`20${br[3]}`:br[3];
  return `${year}-${br[2].padStart(2,"0")}-${br[1].padStart(2,"0")}`;
};
const displayDate=(value:string)=>{
  if(!value)return "—";
  const input=toDateInput(value);
  if(!input)return value;
  const [year,month,day]=input.split("-");
  return `${day}/${month}/${year}`;
};
const localIso=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const startOfWeek=(date:Date)=>{const result=new Date(date);result.setHours(0,0,0,0);const day=result.getDay();result.setDate(result.getDate()-(day===0?6:day-1));return result;};
const endOfWeek=(date:Date)=>{const result=startOfWeek(date);result.setDate(result.getDate()+6);return result;};
const dateInPeriod=(value:string,start:string,end:string)=>{const input=toDateInput(value);return Boolean(input&&input>=start&&input<=end);};
function ContactLinks({value}:{value:string}){
  if(!value)return <span>—</span>;
  const parts=value.split(/\s*(?:\n|;|\||\s\/\s)\s*/).map(item=>item.trim()).filter(Boolean);
  return <div className="space-y-0.5">{parts.map((item,index)=>{
    const email=item.replace(/^mailto:/i,"").trim();
    if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return <a key={`${item}-${index}`} href={`mailto:${email}`} className="block break-all font-medium text-blue-700 underline decoration-blue-300 underline-offset-2">{item}</a>;
    const digits=item.replace(/\D/g,"");
    if(!/[a-zá-ú]/i.test(item)&&digits.length>=10&&digits.length<=13){const whatsapp=digits.startsWith("55")?digits:`55${digits}`;return <a key={`${item}-${index}`} href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="block font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-2" title="Abrir no WhatsApp">{item}</a>;}
    return <span key={`${item}-${index}`} className="block break-words">{item}</span>;
  })}</div>;
}
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
  const [reactivating,setReactivating]=useState<Prospect|null>(null);
  const [saving,setSaving]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [showSearch,setShowSearch]=useState(false);
  const [text,setText]=useState("");
  const [segment,setSegment]=useState("");
  const fileInputRef=useRef<HTMLInputElement>(null);
  const [importRows,setImportRows]=useState<ImportRow[]|null>(null);
  const [importName,setImportName]=useState("");
  const [importError,setImportError]=useState("");
  const [showReports,setShowReports]=useState(false);
  const [reportPreset,setReportPreset]=useState<"atual"|"anterior"|"30dias"|"personalizado">("atual");
  const [reportStart,setReportStart]=useState(()=>localIso(startOfWeek(new Date())));
  const [reportEnd,setReportEnd]=useState(()=>localIso(endOfWeek(new Date())));
  const [generatingReport,setGeneratingReport]=useState(false);
  const [reportError,setReportError]=useState("");

  async function load(){ const r=await fetch("/api/leads",{cache:"no-store"}); const result=await r.json(); if(r.ok){setData(result);setImportError("");}else{setData(null);setImportError(result.error??"Não foi possível carregar os dados atuais do Leads.");} }
  useEffect(()=>{ void load(); },[]);

  const segments=useMemo(()=>Array.from(new Set((data?.leads??[]).map(x=>x.segmento).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"pt-BR")),[data]);
  const leads=useMemo(()=>{ let all=data?.leads??[]; if(filter==="pendentes") all=all.filter(x=>x.status==="atrasado"||x.status==="hoje"); else if(filter!=="todos") all=all.filter(x=>x.status===filter); if(segment) all=all.filter(x=>x.segmento===segment); const q=text.trim().toLocaleLowerCase("pt-BR"); if(q) all=all.filter(x=>`${x.cliente} ${x.segmento} ${x.contato} ${x.canal} ${x.observacoes}`.toLocaleLowerCase("pt-BR").includes(q)); return all; },[data,filter,segment,text]);
  const prospects=useMemo(()=>{ const q=text.trim().toLocaleLowerCase("pt-BR"); return (data?.prospects??[]).filter(x=>!q||`${x.cliente} ${x.segmento} ${x.cidade} ${x.oportunidade} ${x.observacoes}`.toLocaleLowerCase("pt-BR").includes(q)); },[data,text]);
  useEffect(()=>{
    if(reportPreset==="personalizado")return;
    const today=new Date();
    if(reportPreset==="atual"){setReportStart(localIso(startOfWeek(today)));setReportEnd(localIso(endOfWeek(today)));return;}
    if(reportPreset==="anterior"){const previous=new Date(today);previous.setDate(previous.getDate()-7);setReportStart(localIso(startOfWeek(previous)));setReportEnd(localIso(endOfWeek(previous)));return;}
    const start=new Date(today);start.setDate(start.getDate()-29);setReportStart(localIso(start));setReportEnd(localIso(today));
  },[reportPreset]);
  const report=useMemo(()=>{
    const current=data?.leads??[];
    const activities=(data?.activities??[]).filter(item=>dateInPeriod(item.data,reportStart,reportEnd));
    const completedNames=new Set(activities.filter(item=>item.tipo==="CONTATO").map(item=>item.cliente.toLocaleLowerCase("pt-BR")));
    current.filter(item=>dateInPeriod(item.ultimoContato,reportStart,reportEnd)).forEach(item=>completedNames.add(item.cliente.toLocaleLowerCase("pt-BR")));
    const today=localIso(new Date());
    const pending=current.filter(item=>{const date=toDateInput(item.proximoContato);return date&&date>=today&&date>=reportStart&&date<=reportEnd;}).length;
    const overdue=current.filter(item=>{const date=toDateInput(item.proximoContato);return date&&date<today&&date<=reportEnd;}).length;
    const completed=completedNames.size;
    const total=completed+pending+overdue;
    const progress=total?Math.round((completed/total)*100):0;
    const weekly=Array.from({length:6},(_,position)=>{
      const base=startOfWeek(new Date());
      base.setDate(base.getDate()-((5-position)*7));
      const finish=endOfWeek(base);
      const start=localIso(base),end=localIso(finish);
      const done=new Set<string>();
      (data?.activities??[]).filter(item=>item.tipo==="CONTATO"&&dateInPeriod(item.data,start,end)).forEach(item=>done.add(item.cliente.toLocaleLowerCase("pt-BR")));
      current.filter(item=>dateInPeriod(item.ultimoContato,start,end)).forEach(item=>done.add(item.cliente.toLocaleLowerCase("pt-BR")));
      const scheduled=current.filter(item=>dateInPeriod(item.proximoContato,start,end));
      const late=scheduled.filter(item=>toDateInput(item.proximoContato)<today).length;
      const open=Math.max(0,scheduled.length-late);
      const baseTotal=done.size+open+late;
      return {label:`${displayDate(start).slice(0,5)}–${displayDate(end).slice(0,5)}`,completed:done.size,pending:open,overdue:late,progress:baseTotal?Math.round((done.size/baseTotal)*100):0};
    });
    return {completed,pending,overdue,progress,newLeads:activities.filter(item=>item.tipo==="CADASTRO"||item.tipo==="IMPORTAÇÃO").length,reactivated:activities.filter(item=>item.tipo==="REATIVAÇÃO").length,withoutDate:current.filter(item=>!toDateInput(item.proximoContato)).length,weekly};
  },[data,reportStart,reportEnd]);

  async function saveFollowup(e:React.FormEvent<HTMLFormElement>){ e.preventDefault(); if(!editing)return; setSaving(true); const fd=new FormData(e.currentTarget); const r=await fetch("/api/leads",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({row:editing.row,cliente:fd.get("cliente"),segmento:fd.get("segmento"),contato:fd.get("contato"),canal:fd.get("canal"),ultimoContato:fd.get("ultimoContato"),proximoContato:fd.get("proximoContato"),observacoes:fd.get("observacoes")})}); setSaving(false); if(r.ok){setEditing(null); await load();} else alert((await r.json()).error??"Erro ao salvar"); }
  async function createLead(e:React.FormEvent<HTMLFormElement>){ e.preventDefault(); setSaving(true); const fd=new FormData(e.currentTarget); const payload=Object.fromEntries(fd.entries()); const r=await fetch("/api/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}); setSaving(false); if(r.ok){setShowForm(false); await load();} else alert((await r.json()).error??"Erro ao cadastrar"); }
  async function reactivate(e:React.FormEvent<HTMLFormElement>){ e.preventDefault(); if(!reactivating)return; setSaving(true); const fd=new FormData(e.currentTarget); const r=await fetch("/api/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"reativar",id:reactivating.id,cliente:fd.get("cliente"),segmento:fd.get("segmento"),contato:fd.get("contato"),canal:fd.get("canal"),proximoContato:fd.get("proximoContato"),observacoes:fd.get("observacoes")})}); const result=await r.json(); setSaving(false); if(r.ok){setReactivating(null);setTab("followup");setFilter("todos");await load();}else alert(result.error??"Erro ao reativar"); }
  async function readImportFile(file:File){
    setImportError("");
    try {
      if(!data) throw new Error("Os dados atuais do Leads ainda não foram carregados. Atualize a página e tente novamente.");
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
      const parsed=matrix.slice(1).map((raw,index)=>({raw,index})).filter(({raw})=>Array.isArray(raw)&&raw.some(cell=>String(cell??"").trim())).map(({raw,index})=>{
        const row=Array.isArray(raw)?raw:[];
        const cliente=value(row,"cliente");
        const key=cliente.toLocaleLowerCase("pt-BR");
        const duplicate=Boolean(cliente)&&(existing.has(key)||seen.has(key));
        if(cliente&&!duplicate) seen.add(key);
        return {cliente,segmento:value(row,"segmento"),contato:value(row,"contato"),canal:value(row,"canal"),ultimoContato:normalizeImportDate(value(row,"ultimoContato")),proximoContato:normalizeImportDate(value(row,"proximoContato")),observacoes:value(row,"observacoes"),sourceRow:index+2,duplicate,error:cliente?undefined:"Empresa não informada"};
      });
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
  async function generateGoogleReport(){
    setGeneratingReport(true);setReportError("");
    try{
      const response=await fetch("/api/leads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"gerar_relatorio",startDate:reportStart,endDate:reportEnd})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error??"Não foi possível gerar o relatório.");
      window.open(result.url,"_blank","noopener,noreferrer");
    }catch(error){setReportError(error instanceof Error?error.message:"Não foi possível gerar o relatório.");}
    finally{setGeneratingReport(false);}
  }
  function googleSearch(e:React.FormEvent<HTMLFormElement>){ e.preventDefault(); const fd=new FormData(e.currentTarget); const segmento=String(fd.get("segmento")??"").trim(); const regiao=String(fd.get("regiao")??"").trim(); const oportunidade=String(fd.get("oportunidade")??"").trim(); const query=[segmento,regiao,oportunidade].filter(Boolean).join(" "); if(!query) return; window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`,"_blank","noopener,noreferrer"); window.open(`https://www.google.com/maps/search/${encodeURIComponent([segmento,regiao].filter(Boolean).join(" "))}`,"_blank","noopener,noreferrer"); }

  const badge=(s:Lead["status"])=> s==="atrasado"?"bg-red-100 text-red-700":s==="hoje"?"bg-amber-100 text-amber-800":s==="sem-data"?"bg-slate-100 text-slate-600":"bg-emerald-50 text-emerald-700";
  return <div className="pb-8">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-blue-700">Casa Timoni</p><h1 className="text-2xl font-semibold text-slate-950">Leads</h1><p className="mt-1 text-sm text-slate-600">Follow-up e prospecção sem complicação.</p></div><div className="flex flex-wrap gap-2"><input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)void readImportFile(file)}}/><button onClick={()=>setShowReports(value=>!value)} className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700">Avanço comercial</button><button onClick={()=>fileInputRef.current?.click()} className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700">Importar arquivo</button><button onClick={()=>setShowSearch(true)} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">Buscar empresas</button><button onClick={()=>setShowForm(true)} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white">+ Cadastrar</button></div></div>
    {importError&&!importRows&&<div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{importError}</div>}

    <section className="grid gap-3 sm:grid-cols-5">
      <button onClick={()=>{setTab("followup");setFilter("pendentes")}} className="rounded-2xl border border-red-200 bg-red-50 p-4 text-left"><b className="text-3xl">{data?.summary.pendentes??"—"}</b><p className="text-xs">para agir hoje</p></button>
      <button onClick={()=>{setTab("followup");setFilter("atrasado")}} className="rounded-2xl border p-4 text-left"><b className="text-3xl">{data?.summary.atrasados??"—"}</b><p className="text-xs">atrasados</p></button>
      <button onClick={()=>{setTab("followup");setFilter("hoje")}} className="rounded-2xl border p-4 text-left"><b className="text-3xl">{data?.summary.hoje??"—"}</b><p className="text-xs">para hoje</p></button>
      <button onClick={()=>{setTab("followup");setFilter("sem-data")}} className="rounded-2xl border p-4 text-left"><b className="text-3xl">{data?.summary.semData??"—"}</b><p className="text-xs">sem próxima data</p></button>
      <button onClick={()=>setTab("prospectar")} className="rounded-2xl border p-4 text-left"><b className="text-3xl">{data?.summary.prospectar??"—"}</b><p className="text-xs">a prospectar</p></button>
    </section>

    {showReports&&<section className="mt-5 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-blue-700">Relatórios</p><h2 className="text-xl font-semibold text-slate-950">Avanço comercial</h2><p className="mt-1 text-sm text-slate-500">Acompanhe o realizado e o que ainda precisa de ação.</p></div><button onClick={()=>void generateGoogleReport()} disabled={generatingReport||!data} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{generatingReport?"Gerando...":"Gerar no Google Planilhas"}</button></div>
      <div className="mt-4 flex flex-wrap gap-2"><select value={reportPreset} onChange={event=>setReportPreset(event.target.value as typeof reportPreset)} className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold"><option value="atual">Semana atual</option><option value="anterior">Semana anterior</option><option value="30dias">Últimos 30 dias</option><option value="personalizado">Período personalizado</option></select>{reportPreset==="personalizado"&&<><label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold">De <input type="date" value={reportStart} onChange={event=>setReportStart(event.target.value)} className="bg-transparent"/></label><label className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold">Até <input type="date" value={reportEnd} onChange={event=>setReportEnd(event.target.value)} className="bg-transparent"/></label></>}</div>
      {reportError&&<div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{reportError}</div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl bg-emerald-50 p-3"><b className="text-2xl text-emerald-700">{report.completed}</b><p className="text-xs text-emerald-800">realizados</p></div>
        <div className="rounded-xl bg-blue-50 p-3"><b className="text-2xl text-blue-700">{report.pending}</b><p className="text-xs text-blue-800">pendentes</p></div>
        <div className="rounded-xl bg-red-50 p-3"><b className="text-2xl text-red-700">{report.overdue}</b><p className="text-xs text-red-800">atrasados</p></div>
        <div className="rounded-xl bg-violet-50 p-3"><b className="text-2xl text-violet-700">{report.newLeads}</b><p className="text-xs text-violet-800">novos leads</p></div>
        <div className="rounded-xl bg-amber-50 p-3"><b className="text-2xl text-amber-700">{report.reactivated}</b><p className="text-xs text-amber-800">reativados</p></div>
        <div className="rounded-xl bg-slate-100 p-3"><b className="text-2xl text-slate-700">{report.withoutDate}</b><p className="text-xs text-slate-600">sem próxima data</p></div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1.2fr)]">
        <div className="rounded-xl border p-4"><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avanço do período</p><b className="text-4xl text-blue-800">{report.progress}%</b></div><span className="text-xs text-slate-500">{displayDate(reportStart)} a {displayDate(reportEnd)}</span></div><div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-700 transition-all" style={{width:`${report.progress}%`}}/></div><div className="mt-3 flex flex-wrap gap-4 text-xs"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500"/>Realizado</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-blue-500"/>Pendente</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-red-500"/>Atrasado</span></div></div>
        <div className="overflow-x-auto rounded-xl border"><table className="min-w-full text-xs"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-3 py-2">Semana</th><th className="px-3 py-2 text-center">Realizados</th><th className="px-3 py-2 text-center">Pendentes</th><th className="px-3 py-2 text-center">Atrasados</th><th className="px-3 py-2 text-right">Avanço</th></tr></thead><tbody>{report.weekly.map(item=><tr key={item.label} className="border-t"><td className="whitespace-nowrap px-3 py-2 font-semibold">{item.label}</td><td className="px-3 py-2 text-center text-emerald-700">{item.completed}</td><td className="px-3 py-2 text-center text-blue-700">{item.pending}</td><td className="px-3 py-2 text-center text-red-700">{item.overdue}</td><td className="px-3 py-2 text-right font-semibold">{item.progress}%</td></tr>)}</tbody></table></div>
      </div>
      <p className="mt-3 text-xs text-slate-500">O histórico passa a ser registrado automaticamente a partir desta atualização. As comparações ficarão mais completas a cada semana de uso.</p>
    </section>}

    <div className="mt-5 flex flex-wrap gap-2"><button onClick={()=>setTab("followup")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab==="followup"?"bg-slate-900 text-white":"border bg-white"}`}>Follow-up</button><button onClick={()=>setTab("prospectar")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab==="prospectar"?"bg-slate-900 text-white":"border bg-white"}`}>A prospectar</button></div>
    <div className="mt-3 flex flex-wrap gap-2"><input value={text} onChange={e=>setText(e.target.value)} placeholder="Buscar empresa, contato, produto..." className="min-w-72 flex-1 rounded-xl border bg-white px-3 py-2 text-sm"/>{tab==="followup"&&<select value={segment} onChange={e=>setSegment(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-sm"><option value="">Todos os segmentos</option>{segments.map(x=><option key={x}>{x}</option>)}</select>}{tab==="followup"&&<button onClick={()=>setFilter("todos")} className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold">Ver todos</button>}</div>

    {tab==="followup"?<div className="mt-3 overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[1050px] table-fixed text-sm"><colgroup><col className="w-[18%]"/><col className="w-[11%]"/><col className="w-[18%]"/><col className="w-[11%]"/><col className="w-[12%]"/><col className="w-[22%]"/><col className="w-[8%]"/></colgroup><thead className="bg-slate-50 text-left text-xs text-slate-600"><tr><th className="px-3 py-3">Cliente</th><th className="px-3 py-3">Segmento</th><th className="px-3 py-3">Contato</th><th className="px-3 py-3">Último</th><th className="px-3 py-3">Próximo</th><th className="px-3 py-3">Observações</th><th className="px-3 py-3"></th></tr></thead><tbody>{leads.map(x=><tr key={x.row} className={`border-t ${x.status==="atrasado"?"bg-red-50":""}`}><td className="px-3 py-3 font-semibold">{x.cliente}</td><td className="break-words px-3 py-3">{x.segmento||"—"}</td><td className="px-3 py-3"><div>{x.contato||"—"}</div><div className="mt-0.5 text-xs"><ContactLinks value={x.canal}/></div></td><td className="whitespace-nowrap px-3 py-3 font-medium">{displayDate(x.ultimoContato)}</td><td className="whitespace-nowrap px-3 py-3"><span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${badge(x.status)}`}>{x.proximoContato?displayDate(x.proximoContato):"SEM DATA"}</span></td><td className="break-words px-3 py-3 text-xs text-slate-600">{x.observacoes}</td><td className="px-3 py-3"><button onClick={()=>setEditing(x)} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Editar</button></td></tr>)}</tbody></table></div>
    :<div className="mt-3 overflow-x-auto rounded-2xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-600"><tr>{["Empresa","Segmento","Cidade/Região","Contato","Oportunidade","Observações",""] .map(x=><th key={x} className="px-3 py-3">{x}</th>)}</tr></thead><tbody>{prospects.map(x=><tr key={x.id} className="border-t"><td className="px-3 py-3 font-semibold">{x.cliente}</td><td className="px-3 py-3">{x.segmento||"—"}</td><td className="px-3 py-3">{x.cidade||"—"}</td><td className="px-3 py-3"><div>{x.contato||"—"}</div><div className="mt-0.5 text-xs"><ContactLinks value={x.canal}/></div></td><td className="px-3 py-3">{x.oportunidade||"—"}</td><td className="max-w-sm px-3 py-3 text-xs text-slate-600">{x.observacoes}</td><td className="px-3 py-3"><button onClick={()=>setReactivating(x)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">Reativar</button></td></tr>)}</tbody></table></div>}

    {showSearch&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><form onSubmit={googleSearch} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"><h3 className="text-lg font-semibold">Buscar empresas</h3><p className="mb-4 text-sm text-slate-500">A busca abre Google e Google Maps. Depois, cadastre apenas o que fizer sentido.</p><label className="text-xs font-semibold">Segmento *</label><input name="segmento" required className="mb-3 mt-1 w-full rounded-lg border p-2" placeholder="Ex.: cerâmica, transportadora"/><label className="text-xs font-semibold">Cidade/região *</label><input name="regiao" required className="mb-3 mt-1 w-full rounded-lg border p-2" placeholder="Ex.: Rio Claro SP"/><label className="text-xs font-semibold">Produto/demanda</label><input name="oportunidade" className="mt-1 w-full rounded-lg border p-2" placeholder="Ex.: plástico bolha"/><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={()=>setShowSearch(false)} className="rounded-lg border px-4 py-2">Cancelar</button><button className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">Buscar</button></div></form></div>}

    {importRows&&<div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-2 sm:items-center sm:p-4"><div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)]"><div className="shrink-0 border-b p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Prévia da importação</h3><p className="break-all text-sm text-slate-500">{importName}</p></div><button onClick={()=>{setImportRows(null);setImportName("");setImportError("")}} className="rounded-lg border px-3 py-1 text-lg leading-none" aria-label="Fechar">×</button></div>{importError&&<div className="mt-3 max-h-28 overflow-auto rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{importError}</div>}<div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold"><span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">{importRows.filter(x=>!x.duplicate&&!x.error).length} novos</span><span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">{importRows.filter(x=>x.duplicate).length} duplicados</span><span className="rounded-full bg-red-100 px-3 py-1 text-red-700">{importRows.filter(x=>x.error).length} com erro</span></div></div><div className="min-h-0 flex-1 overflow-auto"><table className="min-w-full text-sm"><thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600"><tr><th className="px-3 py-3">Linha</th><th className="px-3 py-3">Empresa</th><th className="px-3 py-3">Segmento</th><th className="px-3 py-3">Contato</th><th className="px-3 py-3">Situação</th></tr></thead><tbody>{importRows.map(x=><tr key={x.sourceRow} className="border-t"><td className="px-3 py-3">{x.sourceRow}</td><td className="px-3 py-3 font-semibold">{x.cliente||"—"}</td><td className="px-3 py-3">{x.segmento||"—"}</td><td className="px-3 py-3">{x.contato||x.canal||"—"}</td><td className="px-3 py-3">{x.error?<span className="text-red-700">{x.error}</span>:x.duplicate?<span className="text-amber-700">Duplicado — não será importado</span>:<span className="text-emerald-700">Pronto para importar</span>}</td></tr>)}</tbody></table></div><div className="flex shrink-0 flex-wrap justify-end gap-2 border-t bg-white p-3 sm:p-4"><button onClick={()=>{setImportRows(null);setImportName("");setImportError("")}} className="rounded-lg border px-4 py-2">Cancelar</button><button disabled={saving||!importRows.some(x=>!x.duplicate&&!x.error)} onClick={()=>void confirmImport()} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving?"Importando...":`Confirmar importação (${importRows.filter(x=>!x.duplicate&&!x.error).length})`}</button></div></div></div>}

    {showForm&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><form onSubmit={createLead} className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl"><h3 className="text-lg font-semibold">Cadastrar empresa</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><label className="text-xs font-semibold">Destino</label><select name="destino" className="mt-1 w-full rounded-lg border p-2"><option value="prospectar">A prospectar</option><option value="followup">Follow-up</option></select></div><div><label className="text-xs font-semibold">Empresa *</label><input name="cliente" required className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Segmento</label><input name="segmento" className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Cidade/região</label><input name="cidade" className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Contato</label><input name="contato" className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Telefone/e-mail</label><input name="canal" className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Produto/oportunidade</label><input name="oportunidade" className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Próximo contato (se Follow-up)</label><input name="proximoContato" type="date" className="mt-1 w-full rounded-lg border p-2"/></div></div><label className="mt-3 block text-xs font-semibold">Observações</label><textarea name="observacoes" rows={3} className="mt-1 w-full rounded-lg border p-2"/><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={()=>setShowForm(false)} className="rounded-lg border px-4 py-2">Cancelar</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{saving?"Salvando...":"Salvar"}</button></div></form></div>}

    {editing&&<div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-2 sm:items-center sm:p-4"><form onSubmit={saveFollowup} className="my-2 w-full max-w-2xl rounded-2xl bg-white p-4 shadow-xl sm:p-5"><h3 className="text-lg font-semibold">Editar Follow-up</h3><p className="mb-4 text-sm text-slate-500">Atualize os dados e programe o próximo contato.</p><div className="grid gap-3 sm:grid-cols-2"><div><label className="text-xs font-semibold">Empresa *</label><input name="cliente" required defaultValue={editing.cliente} className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Segmento</label><input name="segmento" defaultValue={editing.segmento} className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Contato</label><input name="contato" defaultValue={editing.contato} className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">WhatsApp / e-mail</label><input name="canal" defaultValue={editing.canal} className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Data do contato</label><input name="ultimoContato" type="date" defaultValue={toDateInput(editing.ultimoContato)} className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Próximo contato *</label><input name="proximoContato" type="date" required defaultValue={toDateInput(editing.proximoContato)} className="mt-1 w-full rounded-lg border p-2"/></div></div><label className="mt-3 block text-xs font-semibold">Observações</label><textarea name="observacoes" defaultValue={editing.observacoes} rows={4} className="mt-1 w-full rounded-lg border p-2"/><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={()=>setEditing(null)} className="rounded-lg border px-4 py-2">Cancelar</button><button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white">{saving?"Salvando...":"Salvar alterações"}</button></div></form></div>}

    {reactivating&&<div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-2 sm:items-center sm:p-4"><form onSubmit={reactivate} className="my-2 w-full max-w-2xl rounded-2xl bg-white p-4 shadow-xl sm:p-5"><h3 className="text-lg font-semibold">Reativar para Follow-up</h3><p className="mb-4 text-sm text-slate-500">Complete os dados e programe o próximo contato.</p><div className="grid gap-3 sm:grid-cols-2"><div><label className="text-xs font-semibold">Empresa *</label><input name="cliente" required defaultValue={reactivating.cliente} className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Segmento</label><input name="segmento" defaultValue={reactivating.segmento} className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">Contato</label><input name="contato" defaultValue={reactivating.contato} className="mt-1 w-full rounded-lg border p-2"/></div><div><label className="text-xs font-semibold">WhatsApp / e-mail</label><input name="canal" defaultValue={reactivating.canal} className="mt-1 w-full rounded-lg border p-2"/></div><div className="sm:col-span-2"><label className="text-xs font-semibold">Próximo contato *</label><input name="proximoContato" type="date" required className="mt-1 w-full rounded-lg border p-2"/></div></div><label className="mt-3 block text-xs font-semibold">Observações</label><textarea name="observacoes" defaultValue={reactivating.observacoes} rows={4} className="mt-1 w-full rounded-lg border p-2"/><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={()=>setReactivating(null)} className="rounded-lg border px-4 py-2">Cancelar</button><button disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">{saving?"Reativando...":"Reativar para Follow-up"}</button></div></form></div>}
  </div>;
}
