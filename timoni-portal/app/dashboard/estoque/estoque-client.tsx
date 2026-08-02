"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const EXTENSION_ID = "ffpecldfbicgidadimedcdpddaljkkgg";
const MIN_VERSION = "1.3.0";
const DOWNLOAD_URL = "https://drive.google.com/uc?export=download&id=1AM0XXO7fIuMdVw-7YJVMjPbuIEV2XKqn";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1cESMTRx98e6AbY5vxPCcT7VrqYAbgH0xGUk87ybqHUo/edit";

type Unit = "todas" | "rio_claro" | "araras";
type Need = { id:string; codigo:string; descricao:string; status:string; criadoEm:string; numeroPedido:string; previsaoEntrega:string; observacao:string; clienteAguardando:boolean; unidade:"rio_claro"|"araras"; vendedor:string; quantidade:string; notaVendedor:string };
type Product = { codigo:string; descricao:string; unidade:string };
type Seller = { nome:string; unidade:string };
type Counts = { emAberto:number; aguardandoCompra:number; aguardandoChegada:number; finalizadas:number };
type Summary = { geral:Counts; porUnidade:{ rio_claro:Counts; araras:Counts } };
type Data = { ok:boolean; necessidades:Need[]; produtos:Product[]; vendedores:Seller[]; summary:Summary; error?:string };
type ExtensionResponse = { success?:boolean; version?:string; error?:string };

const empty: Counts = { emAberto:0, aguardandoCompra:0, aguardandoChegada:0, finalizadas:0 };
const emptySummary: Summary = { geral:{...empty}, porUnidade:{rio_claro:{...empty}, araras:{...empty}} };
const cards: Array<[keyof Counts,string]> = [["emAberto","Em aberto"],["aguardandoCompra","Relação de compra"],["aguardandoChegada","A caminho"],["finalizadas","Finalizadas"]];
const input = "rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm";
const primary = "rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700";

function runtime() {
  return (globalThis as typeof globalThis & { chrome?:{ runtime?:{ sendMessage?:(id:string,m:unknown,cb:(r?:ExtensionResponse)=>void)=>void; lastError?:{message?:string} } } }).chrome?.runtime;
}
function sendExtension(action:string):Promise<ExtensionResponse> {
  return new Promise((resolve,reject) => {
    const r = runtime();
    if (!r?.sendMessage) return reject(new Error("Extensão indisponível"));
    const timer = window.setTimeout(() => reject(new Error("A extensão não respondeu")), 3000);
    r.sendMessage(EXTENSION_ID,{action},response => {
      window.clearTimeout(timer);
      if (r.lastError) reject(new Error(r.lastError.message)); else resolve(response || {});
    });
  });
}
function versionOk(current="0") {
  const a=current.split(".").map(Number), b=MIN_VERSION.split(".").map(Number);
  for(let i=0;i<3;i++){ if((a[i]||0)>(b[i]||0))return true; if((a[i]||0)<(b[i]||0))return false; }
  return true;
}
function norm(value:string){ return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim(); }
function findProducts(list:Product[],term:string){
  const q=norm(term), words=q.split(/\s+/).filter(Boolean);
  if(!q)return [];
  return list.filter(p=>norm(p.codigo).startsWith(q)||(words.length>1?words.every(w=>norm(p.descricao).includes(w)):norm(p.descricao).startsWith(q))).sort((a,b)=>a.descricao.localeCompare(b.descricao,"pt-BR")).slice(0,10);
}
function label(status:string){ return ({pendente:"Em aberto",em_compra:"Relação de compra",pedido_existente:"A caminho",observacao:"Aguardando retorno",chegou:"Finalizado"} as Record<string,string>)[status] || status; }
function date(value:string){ if(!value)return ""; const d=new Date(value); return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"}).format(d); }

export default function EstoqueClient(){
  const operationRef=useRef<HTMLDivElement>(null);
  const [mobile,setMobile]=useState(false), [extension,setExtension]=useState<"checking"|"ready"|"missing"|"outdated">("checking"), [extensionVersion,setExtensionVersion]=useState("");
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState(""), [error,setError]=useState(""), [notice,setNotice]=useState("");
  const [needs,setNeeds]=useState<Need[]>([]), [products,setProducts]=useState<Product[]>([]), [sellers,setSellers]=useState<Seller[]>([]), [summary,setSummary]=useState<Summary>(emptySummary);
  const [unit,setUnit]=useState<Unit>("todas"), [newUnit,setNewUnit]=useState<"rio_claro"|"araras">("rio_claro"), [seller,setSeller]=useState(""), [search,setSearch]=useState(""), [selected,setSelected]=useState(""), [quantity,setQuantity]=useState(""), [note,setNote]=useState(""), [waiting,setWaiting]=useState(false);

  const refresh=useCallback(async()=>{
    setLoading(true); setError("");
    try{ const r=await fetch("/api/estoque",{cache:"no-store"}); const p=await r.json() as Data; if(!r.ok||!p.ok)throw new Error(p.error||"Falha ao carregar"); setNeeds(p.necessidades); setProducts(p.produtos); setSellers(p.vendedores); setSummary(p.summary); }
    catch(e){ setError(e instanceof Error?e.message:"Falha ao carregar"); }
    finally{ setLoading(false); }
  },[]);
  useEffect(()=>{ setMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)); void refresh(); void sendExtension("GET_ESTOQUE_SUMMARY").then(r=>{setExtensionVersion(r.version||"");setExtension(r.success?(versionOk(r.version)?"ready":"outdated"):"missing");}).catch(()=>setExtension("missing")); },[refresh]);

  async function post(body:Record<string,unknown>,id="geral"){
    setBusy(id); setError(""); setNotice("");
    try{ const r=await fetch("/api/estoque",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); const p=await r.json() as {ok?:boolean;error?:string;existing?:boolean}; if(!r.ok||!p.ok)throw new Error(p.error||"Falha ao atualizar"); setNotice(p.existing?"Produto já ativo; solicitação mantida.":"Atualizado."); await refresh(); }
    catch(e){ setError(e instanceof Error?e.message:"Falha ao atualizar"); }
    finally{ setBusy(""); }
  }
  async function open(){ if(mobile){operationRef.current?.scrollIntoView({behavior:"smooth"});return;} setBusy("open"); try{const r=await sendExtension("OPEN_ESTOQUE");if(!r.success)throw new Error();setExtension("ready");}catch{setExtension("missing");}finally{setBusy("");} }
  async function order(n:Need){ const number=window.prompt("Número do pedido:",n.numeroPedido||""); if(number===null)return; const forecast=window.prompt("Previsão (AAAA-MM-DD):",n.previsaoEntrega||""); if(forecast===null)return; await post({action:"pedido",id:n.id,numeroPedido:number,previsao:forecast},n.id); }
  async function observe(n:Need){ const text=window.prompt("Resposta ao vendedor:",n.observacao||""); if(text!==null)await post({action:"observacao",id:n.id,texto:text},n.id); }
  async function arrived(n:Need){ if(window.confirm(`Confirmar chegada de ${n.codigo}?`))await post({action:"chegou",id:n.id},n.id); }
  async function create(){ if(!selected)return setError("Selecione um produto."); if(!seller)return setError("Selecione o vendedor."); await post({action:"criar",codigo:selected,unidade:newUnit,vendedor:seller,quantidade:quantity,nota:note,clienteAguardando:waiting}); setSearch("");setSelected("");setQuantity("");setNote("");setWaiting(false); }

  const filtered=useMemo(()=>needs.filter(n=>unit==="todas"||n.unidade===unit),[needs,unit]);
  const openNeeds=filtered.filter(n=>["pendente","em_compra","observacao"].includes(n.status));
  const onWay=filtered.filter(n=>n.status==="pedido_existente");
  const history=filtered.filter(n=>n.status==="chegou").slice(0,50);
  const results=useMemo(()=>findProducts(products,search),[products,search]);
  const sellerOptions=sellers.filter(s=>!s.unidade||s.unidade===newUnit||s.unidade==="todas");
  const install=extension==="missing"||extension==="outdated";

  function NeedCard({n}:{n:Need}){
    const disabled=busy===n.id;
    return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-slate-950"><span className="text-blue-700">{n.codigo}</span> {n.descricao}</p><p className="mt-1 text-xs text-slate-500">{n.unidade==="araras"?"Araras":"Rio Claro"} · {n.vendedor} · Qtd. {n.quantidade||"—"}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{label(n.status)}</span></div>
      {n.notaVendedor&&<p className="mt-3 text-sm text-slate-600">{n.notaVendedor}</p>}{n.observacao&&<p className="mt-3 text-sm font-medium text-amber-700">{n.observacao}</p>}{n.status==="pedido_existente"&&<p className="mt-3 text-sm">Pedido <strong>{n.numeroPedido}</strong> · previsão {n.previsaoEntrega||"não informada"}</p>}<p className="mt-3 text-xs text-slate-400">{date(n.criadoEm)}</p>
      {n.status!=="chegou"&&<div className="mt-4 flex flex-wrap gap-2">{["pendente","observacao"].includes(n.status)&&<button disabled={disabled} onClick={()=>void post({action:"em_compra",id:n.id},n.id)} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Relação de compra</button>}{["pendente","em_compra","observacao"].includes(n.status)&&<button disabled={disabled} onClick={()=>void order(n)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Pedido feito</button>}{["pendente","em_compra","observacao"].includes(n.status)&&<button disabled={disabled} onClick={()=>void observe(n)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Outra resposta</button>}{n.status==="pedido_existente"&&<button disabled={disabled} onClick={()=>void arrived(n)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Produto chegou</button>}</div>}
    </article>;
  }

  return <div className="pb-10">
    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Módulo Estoque</p><h1 className="mt-2 text-3xl font-semibold">Estoque CT</h1><p className="mt-3 text-sm text-slate-600">Computador: abre a lateral. Celular: funciona direto no Portal.</p></div><span className="w-fit rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">Versão oficial 1.3.0</span></div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><button onClick={()=>void open()} disabled={busy==="open"} className={primary}>{mobile?"Usar Estoque no Portal":"Abrir módulo Estoque"}</button><button onClick={()=>void refresh()} className={secondary}>Atualizar informações</button><a href={SHEET_URL} target="_blank" rel="noreferrer" className={secondary+" text-center"}>Abrir planilha</a>{install&&<a href={DOWNLOAD_URL} className="rounded-xl bg-amber-600 px-5 py-3 text-center text-sm font-semibold text-white">Instalar ou atualizar extensão</a>}</div>{!mobile&&<p className="mt-4 text-xs text-slate-500">{extension==="ready"?`Extensão conectada ${extensionVersion}.`:extension==="outdated"?"Extensão desatualizada.":extension==="checking"?"Verificando extensão...":"Extensão não instalada neste computador."}</p>}</section>
    {error&&<div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}</div>}{notice&&<div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">{notice}</div>}
    <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">{cards.map(([key,title])=><article key={key} className="rounded-2xl border bg-white p-4 shadow-sm"><p className="text-3xl font-semibold">{loading?"—":summary.geral[key]}</p><p className="mt-2 text-sm text-slate-500">{title}</p></article>)}</section>
    <div ref={operationRef} className="scroll-mt-24"><section className="mt-5 rounded-3xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Necessidades do estoque</h2><div className="flex rounded-xl bg-slate-100 p-1">{(["todas","rio_claro","araras"] as Unit[]).map(u=><button key={u} onClick={()=>setUnit(u)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${unit===u?"bg-white shadow-sm":"text-slate-500"}`}>{u==="todas"?"Todas":u==="araras"?"Araras":"Rio Claro"}</button>)}</div></div><div className="mt-5 grid gap-5 xl:grid-cols-2"><div><h3 className="font-semibold">Em aberto</h3><div className="mt-3 space-y-3">{openNeeds.map(n=><NeedCard key={n.id} n={n}/>)}{!loading&&!openNeeds.length&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhuma necessidade em aberto.</p>}</div></div><div><h3 className="font-semibold">A caminho</h3><div className="mt-3 space-y-3">{onWay.map(n=><NeedCard key={n.id} n={n}/>)}{!loading&&!onWay.length&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum produto a caminho.</p>}</div></div></div></section>
      <section className="mt-5 rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold">Consultar e solicitar produto</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><select value={newUnit} onChange={e=>{setNewUnit(e.target.value as "rio_claro"|"araras");setSeller("");}} className={input}><option value="rio_claro">Rio Claro</option><option value="araras">Araras</option></select><select value={seller} onChange={e=>setSeller(e.target.value)} className={input}><option value="">Selecione o vendedor</option>{sellerOptions.map(s=><option key={`${s.nome}-${s.unidade}`} value={s.nome}>{s.nome}</option>)}</select></div><input value={search} onChange={e=>{setSearch(e.target.value);setSelected("");}} placeholder="Código ou início da descrição" className={input+" mt-3 w-full"}/>{search&&!selected&&<div className="mt-2 max-h-64 overflow-auto rounded-xl border">{results.map(p=><button key={p.codigo} onClick={()=>{setSelected(p.codigo);setSearch(`${p.codigo} — ${p.descricao}`);}} className="block w-full border-b px-4 py-3 text-left text-sm last:border-0"><strong className="mr-2 text-blue-700">{p.codigo}</strong>{p.descricao}</button>)}{!results.length&&<p className="p-4 text-sm text-slate-500">Nenhum produto encontrado.</p>}</div>}<div className="mt-3 grid gap-3 md:grid-cols-2"><input value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="Quantidade" className={input}/><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Observação opcional" className={input}/></div><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={waiting} onChange={e=>setWaiting(e.target.checked)}/> Cliente aguardando</label><button onClick={()=>void create()} disabled={busy==="geral"} className={primary+" mt-4"}>Registrar necessidade</button></section>
      <section className="mt-5 rounded-3xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-semibold">Histórico</h2><div className="mt-4 space-y-3">{history.map(n=><NeedCard key={n.id} n={n}/>)}{!loading&&!history.length&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum item finalizado.</p>}</div></section>
    </div>
  </div>;
}
