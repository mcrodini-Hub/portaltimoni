"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type LeadStatus = "NOVO" | "CONTATO" | "FOLLOW_UP" | "ORCAMENTO" | "NEGOCIACAO" | "GANHO" | "PERDIDO";
type Lead = {
  id: string; nome: string; telefone: string; loja: string; origem: string; responsavel: string;
  status: LeadStatus; proximoFollowUp: string; observacao: string; criadoEm: string; criadoPor: string; atualizadoEm: string;
};
type Log = { id: string; leadId: string; dataHora: string; usuario: string; acao: string; detalhe: string };

const statusLabels: Record<LeadStatus, string> = {
  NOVO: "Novo",
  CONTATO: "Contato",
  FOLLOW_UP: "Follow-up",
  ORCAMENTO: "Orçamento",
  NEGOCIACAO: "Negociação",
  GANHO: "Ganho",
  PERDIDO: "Perdido",
};

const responsaveis = ["Jeovana", "Adriel", "Carina", "Davi", "João", "José Roberto", "Rafaela", "San", "Carol", "Yan", "Lyra", "Reinaldo", "Paulo"];
const origens = ["WhatsApp", "Telefone", "Google", "Instagram", "Facebook", "Indicação", "Prospecção ativa", "Cliente antigo", "Obra", "Arquiteto/Construtora", "Outro"];

function normalizarTelefone(value: string) { return value.replace(/\D/g, ""); }
function whatsappHref(phone: string) { const d = normalizarTelefone(phone); return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}`; }
function fmt(value?: string) { if (!value) return "—"; return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function CaptacaoClient() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [status, setStatus] = useState<LeadStatus>("CONTATO");
  const [followUp, setFollowUp] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [form, setForm] = useState({ nome: "", telefone: "", loja: "Rio Claro", origem: "WhatsApp", responsavel: "", observacao: "" });

  async function load() {
    setLoading(true); setErro("");
    try {
      const res = await fetch("/api/captacao", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao carregar");
      setLeads(data.leads || []); setLogs(data.logs || []);
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao carregar"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const hoje = todayISO();
  const novos = leads.filter((l) => l.status === "NOVO").length;
  const atrasados = leads.filter((l) => l.proximoFollowUp && l.proximoFollowUp < hoje && !["GANHO", "PERDIDO"].includes(l.status)).length;
  const hojeFollow = leads.filter((l) => l.proximoFollowUp === hoje && !["GANHO", "PERDIDO"].includes(l.status)).length;
  const ganhos = leads.filter((l) => l.status === "GANHO").length;
  const ativos = useMemo(() => leads.filter((l) => !["GANHO", "PERDIDO"].includes(l.status)), [leads]);
  const ordered = useMemo(() => [...ativos].sort((a, b) => {
    const ap = a.proximoFollowUp || "9999-12-31"; const bp = b.proximoFollowUp || "9999-12-31";
    if (ap !== bp) return ap.localeCompare(bp);
    return b.atualizadoEm.localeCompare(a.atualizadoEm);
  }), [ativos]);

  async function criar(e: FormEvent) {
    e.preventDefault(); setSaving(true); setErro("");
    try {
      const res = await fetch("/api/captacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Erro ao cadastrar");
      setForm({ nome: "", telefone: "", loja: "Rio Claro", origem: "WhatsApp", responsavel: "", observacao: "" });
      setShowForm(false); await load();
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao cadastrar"); }
    finally { setSaving(false); }
  }

  async function acao(lead: Lead, payload: Record<string, unknown>) {
    setSaving(true); setErro("");
    try {
      const res = await fetch("/api/captacao", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: lead.id, ...payload }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Erro ao registrar");
      await load();
    } catch (e) { setErro(e instanceof Error ? e.message : "Erro ao registrar"); }
    finally { setSaving(false); }
  }

  function abrirWhatsapp(lead: Lead) {
    window.open(whatsappHref(lead.telefone), "_blank", "noopener,noreferrer");
    void acao(lead, { acao: "WHATSAPP_ABERTO", detalhe: "WhatsApp aberto pelo Portal" });
  }

  function ligar(lead: Lead) {
    window.location.href = `tel:${normalizarTelefone(lead.telefone)}`;
    void acao(lead, { acao: "LIGACAO_INICIADA", detalhe: "Ligação iniciada pelo Portal" });
  }

  async function registrarResultado(e: FormEvent) {
    e.preventDefault(); if (!selected) return;
    await acao(selected, {
      acao: "RESULTADO_REGISTRADO",
      detalhe: detalhe || `Resultado: ${statusLabels[status]}`,
      status,
      proximoFollowUp: followUp,
    });
    setSelected(null); setDetalhe(""); setFollowUp(""); setStatus("CONTATO");
  }

  return (
    <div className="pb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">Comercial</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Captação / Follow-up / Leads</h1>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">+ Novo lead</button>
      </div>

      {erro && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erro}</div>}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[['Novos', novos], ['Follow-ups hoje', hojeFollow], ['Atrasados', atrasados], ['Ganhos', ganhos]].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p></div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={criar} className="mb-4 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <input required placeholder="Cliente" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
            <input required placeholder="Telefone / WhatsApp" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
            <select value={form.loja} onChange={(e) => setForm({ ...form, loja: e.target.value })} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option>Rio Claro</option><option>Araras</option></select>
            <select value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">{origens.map((o) => <option key={o}>{o}</option>)}</select>
            <select required value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">Responsável</option>{responsaveis.map((r) => <option key={r}>{r}</option>)}</select>
            <input placeholder="Observação curta" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
          </div>
          <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button><button disabled={saving} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Salvar lead</button></div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3"><h2 className="font-semibold text-slate-950">Fila de trabalho</h2><p className="text-xs text-slate-500">Atrasados e follow-ups mais próximos aparecem primeiro.</p></div>
        {loading ? <p className="p-5 text-sm text-slate-500">Carregando...</p> : ordered.length === 0 ? <p className="p-5 text-sm text-slate-500">Nenhum lead ativo.</p> : (
          <div className="divide-y divide-slate-100">
            {ordered.map((lead) => {
              const overdue = lead.proximoFollowUp && lead.proximoFollowUp < hoje;
              return <div key={lead.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{lead.nome}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{statusLabels[lead.status]}</span>{overdue && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">Atrasado</span>}</div><p className="mt-1 text-sm text-slate-600">{lead.telefone} · {lead.loja} · {lead.origem} · {lead.responsavel}</p><p className="mt-1 text-xs text-slate-500">Próximo: {lead.proximoFollowUp || "sem data"} · Última ação: {fmt(lead.atualizadoEm)}</p></div>
                  <div className="flex flex-wrap gap-2"><button onClick={() => abrirWhatsapp(lead)} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">WhatsApp</button><button onClick={() => ligar(lead)} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">Ligar</button><button onClick={() => setSelected(lead)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Registrar resultado</button></div>
                </div>
              </div>;
            })}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold text-slate-950">Histórico recente</h2>
        <div className="mt-3 space-y-2">{logs.slice(0, 25).map((log) => { const lead = leads.find((l) => l.id === log.leadId); return <div key={log.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm"><span className="font-semibold text-slate-900">{lead?.nome || "Lead"}</span><span className="text-slate-500"> · {fmt(log.dataHora)} · {log.acao.replaceAll("_", " ")}</span>{log.detalhe && <p className="mt-0.5 text-xs text-slate-600">{log.detalhe}</p>}</div>; })}</div>
      </div>

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><form onSubmit={registrarResultado} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"><h2 className="text-lg font-semibold text-slate-950">Registrar resultado</h2><p className="mt-1 text-sm text-slate-500">{selected.nome}</p><div className="mt-4 grid gap-3"><select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm">{Object.entries(statusLabels).slice(1).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /><textarea placeholder="O que aconteceu?" value={detalhe} onChange={(e) => setDetalhe(e.target.value)} rows={3} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button><button disabled={saving} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Registrar</button></div></form></div>}
    </div>
  );
}
