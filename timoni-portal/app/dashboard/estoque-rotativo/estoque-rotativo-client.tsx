"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Status = "aguardando_mapeamento" | "aguardando_conferencia" | "em_conferencia" | "atualizado";
type Situation = "encontrado" | "nao_encontrado" | "sem_alteracao";
type Update = {
  id: string; supplier_name: string; spreadsheet_name: string; spreadsheet_link: string; note: string;
  reported_by: string; reported_at: string; status: Status; locked_by: string | null;
  items_read: number; found_count: number; not_found_count: number; unchanged_count: number; updated_count: number;
  source_sheet_name: string; source_code_column: string; source_description_column: string;
  source_stock_column: string; source_start_row: number;
};
type Item = {
  id: string; code: string; description: string; old_stock: number | null; new_stock: number;
  situation: Situation; target_row: number | null; applied: boolean;
};
type Supplier = {
  id: string; name: string; spreadsheet_id: string; sheet_name: string; data_range: string;
  code_column: number; description_column: number; stock_column: number; validated_at: string | null;
};
type TrelloSupplier = { id: string; name: string; url: string; unit?: string; urgent?: boolean };
type ComprasData = { configured?: boolean; suppliers?: TrelloSupplier[] };

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
  const [trelloSuppliers, setTrelloSuppliers] = useState<TrelloSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshingTrello, setRefreshingTrello] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [spreadsheetReference, setSpreadsheetReference] = useState("");
  const [note, setNote] = useState("");
  const [sourceSheetName, setSourceSheetName] = useState("");
  const [sourceCodeColumn, setSourceCodeColumn] = useState("");
  const [sourceDescriptionColumn, setSourceDescriptionColumn] = useState("");
  const [sourceStockColumn, setSourceStockColumn] = useState("");
  const [sourceStartRow, setSourceStartRow] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todos" | Situation>("todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
  const refreshTrello = useCallback(async (showFeedback = false) => {
    setRefreshingTrello(true);
    setError("");
    try {
      const response = await fetch("/api/estoque-rotativo/fornecedores?refresh=" + Date.now(), { cache: "no-store" });
      const result = await response.json() as ComprasData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar os cards do Trello.");
      setTrelloSuppliers(result.suppliers || []);
      if (showFeedback) setFeedback("Cards atualizados: " + (result.suppliers?.length || 0) + " pendente(s).");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar os cards do Trello.");
    } finally {
      setRefreshingTrello(false);
    }
  }, []);

  useEffect(() => { void refreshTrello(); }, [refreshTrello]);

  const registeredPendingNames = useMemo(
    () => new Set((data?.updates || []).filter((item) => item.status === "aguardando_conferencia" || item.status === "aguardando_mapeamento").map((item) => item.supplier_name.trim().toLocaleLowerCase("pt-BR"))),
    [data?.updates],
  );
  const pending = trelloSuppliers.length || registeredPendingNames.size;
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

  function reopenForEdit(item: Update) {
    setEditingId(item.id);
    setSupplierName(item.supplier_name);
    setSpreadsheetReference(item.spreadsheet_link || item.spreadsheet_name);
    setNote(item.note || "");
    setSourceSheetName(item.source_sheet_name || "");
    setSourceCodeColumn(item.source_code_column || "");
    setSourceDescriptionColumn(item.source_description_column || "");
    setSourceStockColumn(item.source_stock_column || "");
    setSourceStartRow(String(item.source_start_row || ""));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const allowedNames = useMemo(
    () => new Set(trelloSuppliers.map((supplier) => supplier.name.trim().toLocaleLowerCase("pt-BR"))),
    [trelloSuppliers],
  );
  const visibleUpdates = useMemo(
    () => (data?.updates || []).filter((item) => allowedNames.has(item.supplier_name.trim().toLocaleLowerCase("pt-BR"))),
    [data?.updates, allowedNames],
  );

  async function report() {
    const payload = {
      supplierName,
      spreadsheetReference,
      note,
      sourceSheetName,
      sourceCodeColumn,
      sourceDescriptionColumn,
      sourceStockColumn,
      sourceStartRow: Number(sourceStartRow),
    };
    const result = await post(editingId ? { action: "editar_registro", id: editingId, ...payload } : { action: "registrar", ...payload });
    if (!result) return;
    setFeedback(editingId ? "Registro reaberto para nova conferência." : "Atualização pendente criada e enviada para conferência.");
    setEditingId(null);
    setSupplierName("");
    setSpreadsheetReference("");
    setNote("");
    setSourceSheetName("");
    setSourceCodeColumn("");
    setSourceDescriptionColumn("");
    setSourceStockColumn("");
    setSourceStartRow("");
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

    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[
        ["Atualizações pendentes", pending, "border-amber-200 bg-amber-50"],
        ["Em conferência", inConference, "border-blue-200 bg-blue-50"],
        ["Atualizadas no mês", updatedMonth, "border-emerald-200 bg-emerald-50"],
      ].map(([label, value, color]) =>
        <div key={String(label)} className={`rounded-2xl border p-4 ${color}`}><p className="text-2xl font-bold text-slate-950">{value}</p><p className="mt-1 text-sm text-slate-700">{label}</p></div>)}
    </section>

    {feedback ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{feedback}</p> : null}
    {error ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</p> : null}
    {loading ? <p className="mt-5 text-sm text-slate-500">Carregando...</p> : null}

    {!activeId && data?.permissions.canReport ? <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Atualizações pendentes — Trello</h2>
        <p className="mt-1 text-sm text-slate-600">Cards carregados automaticamente da lista ESTOQUE ROTATIVO LUCAS/CAROL.</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {trelloSuppliers.length ? trelloSuppliers.map((supplier) => {
          const existing = (data.updates || []).find((item) => item.supplier_name.trim().toLocaleLowerCase("pt-BR") === supplier.name.trim().toLocaleLowerCase("pt-BR") && item.status !== "atualizado");
          return <article key={supplier.id} className={`rounded-xl border p-4 ${supplierName === supplier.name && !editingId ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-semibold text-slate-950">{supplier.name}</p><p className="mt-1 text-xs text-slate-500">ESTOQUE ROTATIVO LUCAS/CAROL</p></div>
              {existing ? <StatusBadge status={existing.status} /> : <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Pendente</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {existing
                ? <button type="button" disabled={busy} onClick={() => reopenForEdit(existing)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Reabrir para editar</button>
                : <button type="button" disabled={busy} onClick={() => { setEditingId(null); setSupplierName(supplier.name); setSpreadsheetReference(""); setNote(""); setSourceSheetName(""); setSourceCodeColumn(""); setSourceDescriptionColumn(""); setSourceStockColumn(""); setSourceStartRow(""); }} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white">Informar planilha</button>}
            </div>
          </article>;
        }) : <p className="text-sm text-slate-500">Nenhum card encontrado na lista ESTOQUE ROTATIVO LUCAS/CAROL.</p>}
      </div>
    </section> : null}

    {data?.permissions.canReport && !activeId && (supplierName || editingId) ? <section className="mt-5 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-950">{editingId ? "Reabrir para editar" : `Informar planilha — ${supplierName}`}</h2>
        {editingId || supplierName ? <button type="button" onClick={() => { setEditingId(null); setSupplierName(""); }} className="text-sm font-semibold text-slate-600">Cancelar</button> : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Fornecedor / grupo<div className="mt-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-semibold text-slate-900">{supplierName}</div></label>
        <label className="text-sm font-medium text-slate-700">Link da planilha<input value={spreadsheetReference} onChange={(event) => setSpreadsheetReference(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
        <label className="text-sm font-medium text-slate-700">Aba da planilha<input value={sourceSheetName} onChange={(event) => setSourceSheetName(event.target.value)} placeholder="Ex.: plan" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
        <label className="text-sm font-medium text-slate-700">Linha inicial<input type="number" min="1" value={sourceStartRow} onChange={(event) => setSourceStartRow(event.target.value)} placeholder="Ex.: 7" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
        <label className="text-sm font-medium text-slate-700">Coluna do código<input value={sourceCodeColumn} onChange={(event) => setSourceCodeColumn(event.target.value.toUpperCase())} placeholder="Ex.: B" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
        <label className="text-sm font-medium text-slate-700">Coluna da descrição<input value={sourceDescriptionColumn} onChange={(event) => setSourceDescriptionColumn(event.target.value.toUpperCase())} placeholder="Ex.: C" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
        <label className="text-sm font-medium text-slate-700">Coluna do estoque<input value={sourceStockColumn} onChange={(event) => setSourceStockColumn(event.target.value.toUpperCase())} placeholder="Ex.: F" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
        <label className="text-sm font-medium text-slate-700 md:col-span-2">Observação opcional<textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2.5" /></label>
      </div>
      <p className="mt-3 text-xs text-slate-500">Todos os campos de planilha, aba, colunas e linha inicial são obrigatórios. Exemplo do teste: aba plan, código B, descrição C, estoque F, a partir da linha 7.</p>
      <div className="mt-4 flex justify-end"><button type="button" disabled={busy} onClick={() => void report()} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Salvando..." : editingId ? "Salvar e reabrir conferência" : "Criar atualização pendente"}</button></div>
    </section> : null}

    {!activeId && data ? <section className="mt-6">
      <h2 className="text-xl font-semibold text-slate-950">Cards atualizados — ESTOQUE ROTATIVO LUCAS/CAROL</h2>
      <div className="mt-3 space-y-3">
        {visibleUpdates.length ? visibleUpdates.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{item.supplier_name}</p><p className="mt-1 text-sm text-slate-600">{item.spreadsheet_name || item.spreadsheet_link} · {formatDate(item.reported_at)}</p></div><StatusBadge status={item.status} /></div>
          {item.note ? <p className="mt-2 text-sm text-slate-600">{item.note}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{item.items_read} lidos</span><span>·</span><span>{item.found_count} encontrados</span><span>·</span><span>{item.not_found_count} não encontrados</span></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.permissions.canReport ? <button type="button" disabled={busy} onClick={() => reopenForEdit(item)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Reabrir para editar</button> : null}
            {data.permissions.canConference && ["aguardando_conferencia", "em_conferencia"].includes(item.status) ? <button type="button" disabled={busy} onClick={() => void conference(item.id)} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-800">{item.status === "em_conferencia" ? "Reabrir conferência" : "Conferir"}</button> : null}
          </div>
        </article>) : <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">Nenhuma atualização registrada.</p>}
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
