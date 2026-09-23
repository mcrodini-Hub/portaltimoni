"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Status = "aguardando_mapeamento" | "aguardando_conferencia" | "em_conferencia" | "atualizado";
type Situation = "encontrado" | "nao_encontrado" | "sem_alteracao";
type Update = {
  id: string; supplier_name: string; spreadsheet_name: string; spreadsheet_link: string; note: string;
  reported_by: string; reported_at: string; status: Status; locked_by: string | null;
  items_read: number; found_count: number; not_found_count: number; unchanged_count: number; updated_count: number;
  source_sheet_name: string; source_code_column: string; source_description_column: string;
  source_stock_column: string; source_start_row: number; trello_card_id: string; updated_rows?: number[]; conference_rows?: number[];
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
  encontrado: "Divergência",
  nao_encontrado: "Não encontrado",
  sem_alteracao: "OK",
};

function updatedSheetUrl(updateId: string) {
  return `/api/estoque-rotativo?openUpdateId=${encodeURIComponent(updateId)}`;
}
const SUPPLIERS_DRIVE_URL = "https://drive.google.com/drive/u/0/folders/1P7Nb1FwfSQ6e7TA9Wkgizyy53tGGQajk";
const TRELLO_URL = "https://trello.com/b/UfPrTr1H/compras";

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
  const [trelloCardId, setTrelloCardId] = useState("");
  const [spreadsheetReference, setSpreadsheetReference] = useState("");
  const [note, setNote] = useState("");
  const [sourceSheetName, setSourceSheetName] = useState("");
  const [detectingSheet, setDetectingSheet] = useState(false);
  const [sourceCodeColumn, setSourceCodeColumn] = useState("B");
  const [sourceDescriptionColumn, setSourceDescriptionColumn] = useState("C");
  const [sourceStockColumn, setSourceStockColumn] = useState("F");
  const [sourceStartRow, setSourceStartRow] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async (id?: string | null) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/estoque-rotativo${id ? `?id=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar o módulo.");
      setData(result);
      if (id) setActiveId(id);
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

  useEffect(() => {
    const reference = spreadsheetReference.trim();
    if (!reference || !/\/spreadsheets\/d\/[a-zA-Z0-9_-]+/.test(reference)) return;
    const timer = window.setTimeout(async () => {
      setDetectingSheet(true);
      try {
        const response = await fetch(`/api/estoque-rotativo?spreadsheetReference=${encodeURIComponent(reference)}`, { cache: "no-store" });
        const result = await response.json() as { singleSheetName?: string | null };
        if (response.ok && result.singleSheetName) setSourceSheetName(result.singleSheetName);
      } finally {
        setDetectingSheet(false);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [spreadsheetReference]);

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
    setActiveId(null);
    setEditingId(item.id);
    setSupplierName(item.supplier_name);
    setTrelloCardId(item.trello_card_id || "");
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
    () => (data?.updates || []).filter(
      (item) => item.status === "atualizado" || allowedNames.has(item.supplier_name.trim().toLocaleLowerCase("pt-BR")),
    ),
    [data?.updates, allowedNames],
  );

  async function filterItems() {
    setError("");
    setFeedback("");
    if (!supplierName.trim()) {
      setError("Selecione um card do fornecedor.");
      return;
    }
    if (!spreadsheetReference.trim()) {
      setError("Cole o link da planilha do fornecedor.");
      return;
    }
    if (!sourceSheetName.trim()) {
      setError("Informe a aba da planilha. Quando houver apenas uma aba, o Portal preenche automaticamente.");
      return;
    }
    if (![sourceCodeColumn, sourceDescriptionColumn, sourceStockColumn].every((column) => /^[A-Z]+$/i.test(column.trim()))) {
      setError("Revise as colunas de código, descrição e estoque.");
      return;
    }
    if (!Number.isInteger(Number(sourceStartRow)) || Number(sourceStartRow) < 1) {
      setError("Informe a linha inicial.");
      return;
    }
    const payload = {
      supplierName,
      spreadsheetReference,
      note,
      sourceSheetName,
      sourceCodeColumn,
      sourceDescriptionColumn,
      sourceStockColumn,
      sourceStartRow: Number(sourceStartRow),
      trelloCardId,
    };
    const saved = await post(editingId
      ? { action: "editar_registro", id: editingId, ...payload }
      : { action: "registrar", ...payload });
    if (!saved) return;
    const id = editingId || String(saved.id || "");
    if (!id) {
      setError("Não foi possível identificar a atualização.");
      return;
    }
    setEditingId(id);
    const compared = await post({ action: "conferir", id });
    if (!compared) return;
    setFeedback("Itens filtrados. Confira as divergências antes de atualizar o Estoque Rotativo.");
    await load(id);
  }

  async function conference(id: string) {
    const result = await post({ action: "conferir", id });
    if (!result) return;
    setFeedback("Comparação carregada. Revise a seleção antes de atualizar.");
    await load(id);
  }

  async function apply() {
    if (!activeId) return;
    const divergenceIds = (data?.items || []).filter((item) => item.situation === "encontrado").map((item) => item.id);
    const confirmation = divergenceIds.length
      ? `Atualizar ${divergenceIds.length} produto(s) com divergência?`
      : "Concluir o Rotativo? Todos os itens estão OK e nenhum estoque precisa ser alterado.";
    if (!window.confirm(confirmation)) return;
    const result = await post({ action: "atualizar", id: activeId, selectedIds: divergenceIds });
    if (!result) return;
    setFeedback(
      `${result.reviewed || 0} item(ns) conferido(s). ${result.updated || 0} estoque(s) alterado(s). Status gravado na planilha como "${result.status || "Atualizado"}". Card do Trello concluído.`,
    );
    setActiveId(null);
    await Promise.all([load(), refreshTrello()]);
  }

  async function removeCompleted(item: Update) {
    if (!data?.permissions.canManage || item.status !== "atualizado") return;
    if (!window.confirm(`Excluir o rotativo concluído de ${item.supplier_name} do histórico?`)) return;
    const result = await post({ action: "excluir_atualizacao", id: item.id });
    if (!result) return;
    setFeedback("Rotativo concluído excluído do histórico.");
    await load();
  }

  const visibleItems = data?.items || [];

  return (
    <div className="space-y-5 pb-10">
      <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Módulo operacional</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Estoque Rotativo</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Selecione o card, filtre a planilha do fornecedor, confira as divergências e só então atualize a planilha central.
            </p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            Fluxo rápido
          </span>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Atualizações pendentes", pending],
          ["Em conferência", inConference],
          ["Atualizadas no mês", updatedMonth],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-3xl font-semibold text-slate-950">{loading ? "…" : value ?? "—"}</p>
            <p className="mt-2 text-sm text-slate-600">{label}</p>
          </article>
        ))}
      </section>

      {feedback ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
          {feedback}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">{error}</p>
      ) : null}

      {data?.permissions.canReport ? (
        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">1. Fornecedor</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">Atualizações pendentes</h2>
                <p className="mt-1 text-sm text-slate-500">Cards de ESTOQUE ROTATIVO LUCAS/CAROL.</p>
              </div>
              <button
                type="button"
                onClick={() => void refreshTrello(true)}
                disabled={refreshingTrello}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50"
              >
                {refreshingTrello ? "Atualizando..." : "Atualizar"}
              </button>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto rounded-2xl border border-slate-200">
              {trelloSuppliers.length ? trelloSuppliers.map((supplier) => {
                const existing = (data.updates || []).find((item) =>
                  item.supplier_name.trim().toLocaleLowerCase("pt-BR") === supplier.name.trim().toLocaleLowerCase("pt-BR")
                  && item.status !== "atualizado"
                );
                const chosen = supplierName === supplier.name;
                return (
                  <button
                    type="button"
                    key={supplier.id}
                    onClick={() => {
                      if (existing) {
                        reopenForEdit(existing);
                        return;
                      }
                      setActiveId(null);
                      setEditingId(null);
                      setSupplierName(supplier.name);
                      setTrelloCardId(supplier.id);
                      setSpreadsheetReference("");
                      setNote("");
                      setSourceSheetName("");
                      setSourceCodeColumn("B");
                      setSourceDescriptionColumn("C");
                      setSourceStockColumn("F");
                      setSourceStartRow("");
                      setError("");
                      setFeedback("");
                    }}
                    className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 ${chosen ? "bg-blue-50 text-blue-900" : "bg-white text-slate-800 hover:bg-slate-50"}`}
                  >
                    <span className="font-semibold">{supplier.name}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {chosen ? <span className="rounded-full bg-blue-700 px-2 py-0.5 text-[11px] font-semibold text-white">Selecionado</span> : null}
                      {!chosen && existing ? <StatusBadge status={existing.status} /> : null}
                      {!chosen && !existing ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Pendente</span> : null}
                    </span>
                  </button>
                );
              }) : <p className="p-5 text-sm text-slate-500">Nenhum card pendente.</p>}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={TRELLO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 px-4 text-sm font-semibold text-blue-800"
              >
                Abrir Trello
              </a>
              <a
                href={SUPPLIERS_DRIVE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white"
              >
                Abrir pasta de fornecedores
              </a>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">2. Itens do estoque</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Planilha do fornecedor</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Mesmo fluxo de Compras: informe a planilha, filtre os itens e confira o resultado antes de atualizar.
            </p>

            <label className="mt-4 block text-sm font-semibold text-slate-800">
              Fornecedor / grupo
              <div className="mt-2 min-h-12 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm">
                {supplierName || "Selecione um card ao lado"}
              </div>
            </label>

            <label className="mt-4 block text-sm font-semibold text-slate-800">
              Link do Google Sheets
              <input
                type="url"
                value={spreadsheetReference}
                onChange={(event) => setSpreadsheetReference(event.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-600"
              />
            </label>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-sm font-semibold text-slate-800">
                Aba
                <input
                  value={sourceSheetName}
                  onChange={(event) => setSourceSheetName(event.target.value)}
                  placeholder={detectingSheet ? "Identificando..." : "Ex.: plan"}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </label>
              <label className="text-sm font-semibold text-slate-800">
                Código
                <input
                  value={sourceCodeColumn}
                  onChange={(event) => setSourceCodeColumn(event.target.value.toUpperCase())}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </label>
              <label className="text-sm font-semibold text-slate-800">
                Descrição
                <input
                  value={sourceDescriptionColumn}
                  onChange={(event) => setSourceDescriptionColumn(event.target.value.toUpperCase())}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </label>
              <label className="text-sm font-semibold text-slate-800">
                Estoque
                <input
                  value={sourceStockColumn}
                  onChange={(event) => setSourceStockColumn(event.target.value.toUpperCase())}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </label>
              <label className="text-sm font-semibold text-slate-800">
                Linha inicial
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={sourceStartRow}
                  onChange={(event) => setSourceStartRow(event.target.value)}
                  placeholder="Ex.: 7"
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </label>
            </div>

            <label className="mt-4 block text-sm font-semibold text-slate-800">
              Observação <span className="font-normal text-slate-500">(opcional)</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
            </label>

            <button
              type="button"
              onClick={() => void filterItems()}
              disabled={busy || !supplierName}
              className="mt-4 min-h-12 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-slate-300"
            >
              {busy ? "Filtrando..." : "Filtrar itens do estoque"}
            </button>
            {activeId && data?.items?.length ? (
              <p className="mt-3 text-sm font-semibold text-emerald-700">{sourceSheetName || "Aba"} · {data.items.length} itens</p>
            ) : null}
          </article>
        </section>
      ) : null}

      {activeId && data ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Itens filtrados</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Total: {visibleItems.length} itens</h2>
            <p className="mt-1 text-sm text-slate-500">Lista simples da conferência: OK, Divergência ou Não encontrado.</p>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-3">Código</th>
                  <th className="px-3 py-3">Descrição</th>
                  <th className="px-3 py-3 text-right">Estoque atual</th>
                  <th className="px-3 py-3 text-right">Novo estoque</th>
                  <th className="px-3 py-3">Conferência</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-3 font-semibold text-blue-800">{item.code || "—"}</td>
                    <td className="px-3 py-3 text-slate-700">{item.description || "—"}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-700">{item.old_stock ?? "—"}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-950">{item.new_stock}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        item.situation === "encontrado"
                          ? "bg-amber-100 text-amber-900"
                          : item.situation === "nao_encontrado"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {SITUATION_LABEL[item.situation]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeId && data ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">3. Finalizar</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Atualizar Estoque Rotativo</h2>
          <p className="mt-2 text-sm text-slate-600">
            Itens encontrados passam de Pendente para Atualizado dd/mm/aa. Somente as divergências alteram a quantidade na coluna D.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void apply()}
              disabled={busy}
              className="min-h-12 rounded-xl bg-emerald-700 px-6 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy ? "Atualizando..." : "Atualizar Estoque Rotativo"}
            </button>
          </div>
        </section>
      ) : null}

      {data ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Acompanhamento</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Atualizações registradas</h2>
          </div>
          <div className="mt-4 space-y-3">
            {visibleUpdates.length ? visibleUpdates.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{item.supplier_name}</p>
                    <p className="mt-1 text-sm text-slate-600">{formatDate(item.reported_at)}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {item.items_read} lidos · {item.found_count} divergências · {item.not_found_count} não encontrados · {item.unchanged_count} OK
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                {item.status === "atualizado" ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-sm font-semibold text-emerald-900">
                      Rotativo conferido · {(item.conference_rows || []).length} item(ns)
                    </p>
                    <p className="mt-1 text-xs text-emerald-800">
                      Coluna Status atualizada para todos os itens encontrados.
                    </p>
                    {item.updated_rows?.length ? (
                      <p className="mt-1 text-xs text-emerald-800">
                        {item.updated_count} estoque(s) alterado(s) · destaque amarelo em Produtos!D{item.updated_rows.join(", D")}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-emerald-800">Nenhum estoque precisou ser alterado.</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={updatedSheetUrl(item.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white"
                      >
                        Rotativo atualizado
                      </a>
                      {data.permissions.canManage ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeCompleted(item)}
                          className="min-h-11 rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          Excluir
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.permissions.canReport && item.status !== "atualizado" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => reopenForEdit(item)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                    >
                      Reabrir para editar
                    </button>
                  ) : null}
                </div>
              </article>
            )) : (
              <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">Nenhuma atualização registrada.</p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
