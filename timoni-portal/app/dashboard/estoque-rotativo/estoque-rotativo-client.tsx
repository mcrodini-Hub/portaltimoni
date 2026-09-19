"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Status = "aguardando_mapeamento" | "aguardando_conferencia" | "em_conferencia" | "atualizado";
type Situation = "encontrado" | "nao_encontrado" | "sem_alteracao";
type Update = {
  id: string; supplier_name: string; spreadsheet_name: string; spreadsheet_link: string; note: string;
  reported_by: string; reported_at: string; status: Status; locked_by: string | null;
  items_read: number; found_count: number; not_found_count: number; unchanged_count: number; updated_count: number;
};
type Item = {
  id: string; code: string; description: string; old_stock: number | null; new_stock: number;
  situation: Situation; target_row: number | null; applied: boolean;
};
type Supplier = {
  id: string; name: string; spreadsheet_id: string; sheet_name: string; data_range: string;
  code_column: number; description_column: number; stock_column: number; validated_at: string | null;
};
type ResponseData = {
  updates: Update[]; suppliers: Supplier[]; notFoundPending: number; items: Item[]; currentUpdate: Update | null;
  notFoundItems: Array<{ id: string; update_id: string; code: string; description: string; new_stock: number; supplier_name: string; reported_at: string }>;
  permissions: { canReport: boolean; canConference: boolean; canManage: boolean };
};

const STATUS_LABEL: Record<Status, string> = {
  aguardando_mapeamento: "Aguardando mapeamento",
  aguardando_conferencia: "Aguardando conferência",
  em_conferencia: "Em conferência",
  atualizado: "Atualizado",
};
const SITUATION_LABEL: Record<Situation, string> = {
  encontrado: "Encontrado",
  nao_encontrado: "Não encontrado",
  sem_alteracao: "Sem alteração",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function StatusBadge({ status }: { status: Status }) {
  const color = status === "atualizado" ? "bg-emerald-100 text-emerald-800" : status === "em_conferencia" ? "bg-blue-100 text-blue-800" : status === "aguardando_mapeamento" ? "bg-violet-100 text-violet-800" : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{STATUS_LABEL[status]}</span>;
}

export default function EstoqueRotativoClient() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [supplierName, setSupplierName] = useState("KTELI");
  const [spreadsheetReference, setSpreadsheetReference] = useState("https://docs.google.com/spreadsheets/d/1WhU4TlFxnK4UhjUOIwGCcVC5NvDZlqN6lXhAiIj1i20/edit");
  const [note, setNote] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todos" | Situation>("todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mapping, setMapping] = useState({ name: "", spreadsheetId: "", sheetName: "", dataRange: "", codeColumn: 0, descriptionColumn: 1, stockColumn: 2 });

  const load = useCallback(async (id?: string | null) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/estoque-rotativo${id ? `?id=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar o módulo.");
      setData(result);
      if (id) {
        setActiveId(id);
        setSelected(new Set((result.items || []).filter((item: Item) => item.situation === "encontrado").map((item: Item) => item.id)));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o módulo.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pending = data?.updates.filter((item) => item.status === "aguardando_conferencia" || item.status === "aguardando_mapeamento").length || 0;
  const inConference = data?.updates.filter((item) => item.status === "em_conferencia").length || 0;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const updatedMonth = data?.updates.filter((item) => item.status === "atualizado" && item.reported_at.slice(0, 7) === currentMonth).length || 0;

  async function post(body: Record<string, unknown>) {
    setBusy(true); setError(""); setFeedback("");
    try {
      const response = await fetch("/api/estoque-rotativo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação.");
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a operação.");
      return null;
    } finally { setBusy(false); }
  }

  async function report() {
    const result = await post({ action: "registrar", supplierName, spreadsheetReference, note });
    if (!result) return;
    setFeedback(result.needsMapping ? "Pendência criada. A gestão precisa validar o mapeamento antes da conferência." : "Atualização pendente criada e Carolina avisada no chat.");
    setNote("");
    await load();
  }

  async function conference(id: string) {
    const result = await post({ action: "conferir", id });
    if (!result) return;
    setFeedback("Comparação carregada. Revise a seleção antes de atualizar.");
    await load(id);
  }

  async function apply() {
    if (!activeId) return;
    if (!window.confirm(`Atualizar ${selected.size} produto(s) selecionado(s)?`)) return;
    const result = await post({ action: "atualizar", id: activeId, selectedIds: [...selected] });
    if (!result) return;
    setFeedback(`${result.updated} produto(s) atualizado(s). O amarelo permanecerá por 3 dias.`);
    setActiveId(null); setSelected(new Set());
    await load();
  }

  async function saveMapping() {
    const result = await post({ action: "salvar_mapeamento", ...mapping });
    if (!result) return;
    setFeedback("Mapeamento validado. As pendências correspondentes estão liberadas para conferência.");
    setMapping({ name: "", spreadsheetId: "", sheetName: "", dataRange: "", codeColumn: 0, descriptionColumn: 1, stockColumn: 2 });
    await load();
  }

  async function resolveNotFound(itemId: string) {
    const result = await post({ action: "resolver_nao_encontrado", itemId });
    if (!result) return;
    setFeedback("Pendência marcada como resolvida.");
    await load();
  }

  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return (data?.items || []).filter((item) => (filter === "todos" || item.situation === filter) && (!query || item.code.toLocaleLowerCase("pt-BR").includes(query) || item.description.toLocaleLowerCase("pt-BR").includes(query)));
  }, [data?.items, filter, search]);

  return <div className="pb-10">
    <header className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Rio Claro</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Estoque Rotativo</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Registre relações recebidas, confira os códigos e atualize somente os estoques selecionados.</p>
    </header>

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        ["Atualizações pendentes", pending, "border-amber-200 bg-amber-50"],
        ["Em conferência", inConference, "border-blue-200 bg-blue-50"],
        ["Atualizadas no mês", updatedMonth, "border-emerald-200 bg-emerald-50"],
        ["Não encontrados", data?.notFoundPending || 0, "border-rose-200 bg-rose-50"],
      ].map(([label, value, color]) =>
        <div key={String(label)} className={`rounded-2xl border p-4 ${color}`}><p className="text-2xl font-bold text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-700">{label}</p></div>)}
    </section>

    {feedback ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{feedback}</p> : null}
    {error ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</p> : null}
    {loading ? <p className="mt-5 text-sm text-slate-500">Carregando...</p> : null}

    {data?.permissions.canReport && !activeId ? <section className="mt-5 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Informar planilha atualizada</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Fornecedor / grupo<input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
        <label className="text-sm font-medium text-slate-700">Link ou nome da planilha<input value={spreadsheetReference} onChange={(event) => setSpreadsheetReference(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Observação opcional<textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
      </div>
      <div className="mt-4 flex justify-end"><button type="button" disabled={busy} onClick={() => void report()} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Registrando..." : "Criar atualização pendente"}</button></div>
    </section> : null}

    {data?.permissions.canManage && !activeId ? <details className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-5">
      <summary className="cursor-pointer font-semibold text-violet-950">Validar novo fornecedor e mapeamento</summary>
      <p className="mt-2 text-sm text-violet-800">Os índices começam em zero dentro do intervalo informado. Exemplo B6:D31: código 0, descrição 1, estoque 2.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input aria-label="Fornecedor" placeholder="Fornecedor" value={mapping.name} onChange={(event) => setMapping({ ...mapping, name: event.target.value })} className="rounded-xl border border-violet-200 px-3 py-2.5" />
        <input aria-label="ID ou link da planilha" placeholder="ID ou link da planilha" value={mapping.spreadsheetId} onChange={(event) => setMapping({ ...mapping, spreadsheetId: event.target.value })} className="rounded-xl border border-violet-200 px-3 py-2.5" />
        <input aria-label="Aba" placeholder="Aba" value={mapping.sheetName} onChange={(event) => setMapping({ ...mapping, sheetName: event.target.value })} className="rounded-xl border border-violet-200 px-3 py-2.5" />
        <input aria-label="Intervalo" placeholder="B6:D31" value={mapping.dataRange} onChange={(event) => setMapping({ ...mapping, dataRange: event.target.value })} className="rounded-xl border border-violet-200 px-3 py-2.5" />
        {["codeColumn", "descriptionColumn", "stockColumn"].map((key) => <label key={key} className="text-xs font-medium text-violet-900">{key === "codeColumn" ? "Coluna do código" : key === "descriptionColumn" ? "Coluna da descrição" : "Coluna do estoque"}<input type="number" min={0} value={mapping[key as keyof typeof mapping]} onChange={(event) => setMapping({ ...mapping, [key]: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-violet-200 px-3 py-2.5" /></label>)}
      </div>
      <button type="button" disabled={busy} onClick={() => void saveMapping()} className="mt-4 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Validar mapeamento</button>
    </details> : null}

    {!activeId && data ? <section className="mt-6">
      <h2 className="text-xl font-semibold text-slate-950">Atualizações pendentes / recentes</h2>
      <div className="mt-3 space-y-3">
        {data.updates.length ? data.updates.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{item.supplier_name}</p><p className="mt-1 text-sm text-slate-600">{item.spreadsheet_name || item.spreadsheet_link} · {formatDate(item.reported_at)}</p></div><StatusBadge status={item.status} /></div>
          {item.note ? <p className="mt-2 text-sm text-slate-600">{item.note}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{item.items_read} lidos</span><span>·</span><span>{item.found_count} encontrados</span><span>·</span><span>{item.not_found_count} não encontrados</span></div>
          {data.permissions.canConference && ["aguardando_conferencia", "em_conferencia"].includes(item.status) ? <button type="button" disabled={busy} onClick={() => void conference(item.id)} className="mt-3 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-800">{item.status === "em_conferencia" ? "Reabrir conferência" : "Conferir"}</button> : null}
        </article>) : <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">Nenhuma atualização registrada.</p>}
      </div>
    </section> : null}

    {!activeId && data?.permissions.canConference && data.notFoundItems.length ? <section className="mt-6">
      <h2 className="text-xl font-semibold text-slate-950">Pendências de produtos não encontrados</h2>
      <p className="mt-1 text-sm text-slate-600">Estes produtos não são criados automaticamente e permanecem aqui até uma decisão manual.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {data.notFoundItems.map((item) => <article key={item.id} className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="font-semibold text-rose-950">{item.code} · {item.description || "Sem descrição"}</p>
          <p className="mt-1 text-sm text-rose-800">{item.supplier_name} · estoque informado: {item.new_stock}</p>
          <button type="button" disabled={busy} onClick={() => void resolveNotFound(item.id)} className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-800">Marcar como resolvido</button>
        </article>)}
      </div>
    </section> : null}

    {activeId && data ? <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-blue-700">Conferência</p><h2 className="text-xl font-semibold text-slate-950">{data.currentUpdate?.supplier_name}</h2></div><button type="button" onClick={() => { setActiveId(null); void load(); }} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Voltar</button></div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{[["Itens", data.items.length], ["Encontrados", data.items.filter((item) => item.situation === "encontrado").length], ["Não encontrados", data.items.filter((item) => item.situation === "nao_encontrado").length], ["Sem alteração", data.items.filter((item) => item.situation === "sem_alteracao").length], ["Selecionados", selected.size]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xl font-bold text-slate-950">{value}</p><p className="text-xs text-slate-600">{label}</p></div>)}</div>
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row">
        <input type="search" placeholder="Buscar código ou descrição" value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5" />
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="todos">Todos</option><option value="encontrado">Encontrados</option><option value="nao_encontrado">Não encontrados</option><option value="sem_alteracao">Sem alteração</option></select>
      </div>
      <div className="mt-3 space-y-2">{visibleItems.map((item) => <article key={`${item.id}-${item.code}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <input aria-label={`Selecionar ${item.code}`} type="checkbox" checked={selected.has(item.id)} disabled={item.situation !== "encontrado"} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(item.id); else next.delete(item.id); return next; })} className="h-5 w-5 accent-blue-700" />
        <div><p className="font-semibold text-slate-950">{item.code} · {item.description}</p><p className="mt-1 text-sm text-slate-600">Estoque atual: {item.old_stock ?? "—"} → Novo estoque: {item.new_stock}</p></div>
        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${item.situation === "encontrado" ? "bg-blue-100 text-blue-800" : item.situation === "nao_encontrado" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"}`}>{SITUATION_LABEL[item.situation]}</span>
      </article>)}</div>
      <div className="sticky bottom-3 mt-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-lg"><p className="text-sm font-semibold text-slate-700">{selected.size} selecionado(s)</p><button type="button" disabled={busy || !selected.size} onClick={() => void apply()} className="rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Atualizando..." : "Atualizar estoque"}</button></div>
    </section> : null}
  </div>;
}
