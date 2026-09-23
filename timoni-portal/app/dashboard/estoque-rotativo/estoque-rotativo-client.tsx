"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Status = "aguardando_mapeamento" | "aguardando_conferencia" | "em_conferencia" | "atualizado";
type Situation = "encontrado" | "nao_encontrado" | "sem_alteracao";
type Update = {
  id: string; supplier_name: string; spreadsheet_name: string; spreadsheet_link: string; note: string;
  reported_by: string; reported_at: string; status: Status; locked_by: string | null;
  items_read: number; found_count: number; not_found_count: number; unchanged_count: number; updated_count: number;
  source_sheet_name: string; source_code_column: string; source_purchase_code_column: string; source_description_column: string;
  source_stock_column: string; source_start_row: number; trello_card_id: string; updated_rows?: number[]; conference_rows?: number[];
};
type Item = {
  id: string; code: string; source_sale_code: string; purchase_code: string; suggested_code: string; suggestion_reason: string;
  description: string; old_stock: number | null; new_stock: number; situation: Situation; target_row: number | null; applied: boolean;
};
type Supplier = {
  id: string; name: string; spreadsheet_id: string; sheet_name: string; data_range: string;
  code_column: number; description_column: number; stock_column: number; validated_at: string | null;
};
type TrelloSupplier = { id: string; name: string; url: string; unit?: string; urgent?: boolean };
type ComprasData = { configured?: boolean; suppliers?: TrelloSupplier[] };

type SupplierFile = {
  id: string;
  name: string;
  url: string;
};

type SupplierStandardization = {
  spreadsheet_id: string;
  supplier_name: string;
  spreadsheet_url: string;
  sheet_name: string;
  status: "preparada" | "atualizada";
  prepared_at: string;
  prepared_by: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
};

type HistoryItem = {
  id: string; update_id: string; recorded_at: string; code: string;
  old_stock: number | null; current_stock: number; difference: number | null;
};

type ResponseData = {
  updates: Update[]; suppliers: Supplier[]; notFoundPending: number; items: Item[]; currentUpdate: Update | null;
  notFoundItems: Array<{ id: string; update_id: string; code: string; description: string; new_stock: number; supplier_name: string; reported_at: string }>;
  history: HistoryItem[];
  supplierFiles: SupplierFile[];
  supplierStandardizations: SupplierStandardization[];
  permissions: { canReport: boolean; canConference: boolean; canManage: boolean };
};

const STATUS_LABEL: Record<Status, string> = {
  aguardando_mapeamento: "Aguardando mapeamento",
  aguardando_conferencia: "Aguardando conferência",
  em_conferencia: "Em conferência",
  atualizado: "Atualizado",
};

function updatedSheetUrl(updateId: string) {
  return `/api/estoque-rotativo?openUpdateId=${encodeURIComponent(updateId)}`;
}
const SUPPLIERS_DRIVE_URL = "https://drive.google.com/drive/u/0/folders/1P7Nb1FwfSQ6e7TA9Wkgizyy53tGGQajk";
const TRELLO_URL = "https://trello.com/b/UfPrTr1H/compras";

function columnLetterFromIndex(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function startRowFromRange(dataRange: string) {
  const match = dataRange.match(/^[A-Z]+(\d+):/i);
  return match ? match[1] : "";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function signedDifference(value: number | null) {
  if (value === null) return "—";
  if (value > 0) return `+${value}`;
  return String(value);
}

function comparisonResult(item: Item) {
  if (item.situation === "nao_encontrado" && item.suggested_code) return `SUGESTÃO: ${item.suggested_code}`;
  if (item.situation === "nao_encontrado") return "NÃO ENCONTRADO";
  if (item.old_stock === null) return "SEM ESTOQUE ANTERIOR";
  const difference = item.new_stock - item.old_stock;
  if (difference > 0) return `ESTOQUE FILTRADO ACIMA: +${difference}`;
  if (difference < 0) return `ESTOQUE FILTRADO ABAIXO: ${difference}`;
  return "OK";
}

function formatHistoryDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
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
  const [sourcePurchaseCodeColumn, setSourcePurchaseCodeColumn] = useState("C");
  const [sourceDescriptionColumn, setSourceDescriptionColumn] = useState("D");
  const [sourceStockColumn, setSourceStockColumn] = useState("F");
  const [sourceStartRow, setSourceStartRow] = useState("6");
  const [editingConferenceItemId, setEditingConferenceItemId] = useState<string | null>(null);
  const [editingSaleCode, setEditingSaleCode] = useState("");
  const [editingStock, setEditingStock] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [standardizingSupplier, setStandardizingSupplier] = useState(false);
  const [selectedStandardizationSupplierId, setSelectedStandardizationSupplierId] = useState("");
  const [showStandardizationSupplierSelector, setShowStandardizationSupplierSelector] = useState(false);

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
  const stockUpdated = data?.updates.filter((item) => item.status === "atualizado").length || 0;
  const supplierUpdatedIds = useMemo(
    () => new Set((data?.supplierStandardizations || []).filter((item) => item.status === "atualizada").map((item) => item.spreadsheet_id)),
    [data?.supplierStandardizations],
  );
  const supplierUpdated = supplierUpdatedIds.size;
  const supplierPending = Math.max(0, (data?.supplierFiles?.length || 0) - supplierUpdated);
  const preparedSupplier = (data?.supplierStandardizations || []).find((item) => item.status === "preparada") || null;
  const pendingSupplierFiles = useMemo(
    () => (data?.supplierFiles || []).filter((item) => !supplierUpdatedIds.has(item.id)),
    [data?.supplierFiles, supplierUpdatedIds],
  );
  const nextSupplier = preparedSupplier ? null : pendingSupplierFiles[0] || null;
  const selectedStandardizationSupplier = pendingSupplierFiles.find((item) => item.id === selectedStandardizationSupplierId) || null;

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

  async function standardizeNextSupplier(spreadsheetId?: string) {
    setStandardizingSupplier(true);
    const verificationWindow = window.open("about:blank", "_blank");
    const result = await post({
      action: "padronizar_proxima_planilha",
      spreadsheetId: spreadsheetId || undefined,
    });
    setStandardizingSupplier(false);
    if (!result) {
      verificationWindow?.close();
      return;
    }
    if (result.complete) {
      verificationWindow?.close();
      setFeedback("Todas as planilhas de fornecedores já foram padronizadas.");
      await load();
      return;
    }
    if (result.spreadsheetUrl) {
      if (verificationWindow) verificationWindow.location.href = result.spreadsheetUrl;
      else window.open(result.spreadsheetUrl, "_blank", "noopener,noreferrer");
    } else {
      verificationWindow?.close();
    }
    setFeedback(`Planilha ${result.supplierName} pronta para conferência. Confira a planilha aberta e depois marque como atualizada.`);
    setSelectedStandardizationSupplierId("");
    setShowStandardizationSupplierSelector(false);
    await load();
  }

  async function confirmSupplierSheet() {
    if (!preparedSupplier) return;
    const result = await post({
      action: "confirmar_planilha_fornecedor",
      spreadsheetId: preparedSupplier.spreadsheet_id,
    });
    if (!result) return;
    setFeedback(`${result.supplierName} aprovada. O destaque amarelo de revisão foi removido.`);
    await load();
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
    setSourcePurchaseCodeColumn(item.source_purchase_code_column || "");
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
      setError("Revise as colunas COD-VENDA, descrição e estoque.");
      return;
    }
    if (sourcePurchaseCodeColumn.trim() && !/^[A-Z]+$/i.test(sourcePurchaseCodeColumn.trim())) {
      setError("Revise a coluna COD-COMPRA.");
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
      sourcePurchaseCodeColumn,
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

  async function saveConferenceItemCorrection(item: Item) {
    if (!activeId) return;
    const saleCode = editingSaleCode.trim();
    const stock = editingStock.trim();
    if (!saleCode) {
      setError("Informe o COD-VENDA correto.");
      return;
    }
    if (!/^\d+$/.test(stock)) {
      setError("Informe o estoque com número inteiro igual ou maior que zero.");
      return;
    }
    const result = await post({
      action: "corrigir_item_conferencia",
      id: activeId,
      itemId: item.id,
      saleCode,
      newStock: Number(stock),
    });
    if (!result) return;
    setEditingConferenceItemId(null);
    setEditingSaleCode("");
    setEditingStock("");
    setFeedback("Item corrigido. Confira o resultado antes de atualizar a planilha.");
    await load(activeId);
  }

  async function apply() {
    if (!activeId) return;
    const unresolved = (data?.items || []).filter((item) => item.situation === "nao_encontrado");
    if (unresolved.length) {
      setError(`Corrija os ${unresolved.length} item(ns) sem COD-VENDA confirmado antes de atualizar.`);
      return;
    }
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Padronizar fornecedor", supplierPending],
          ["Fornecedor padronizado", supplierUpdated],
          ["Estoque atual pendente", pending],
          ["Estoque atual atualizado", stockUpdated],
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

      {data?.permissions.canManage ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">1. Padronizar fornecedores</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Uma planilha por vez</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading || busy || standardizingSupplier}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50"
              >
                {loading ? "Atualizando..." : "Atualizar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowStandardizationSupplierSelector((value) => !value);
                  setSelectedStandardizationSupplierId("");
                }}
                disabled={busy || standardizingSupplier || Boolean(preparedSupplier)}
                className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50"
              >
                Selecionar empresa
              </button>
            </div>
          </div>

          {preparedSupplier ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Aguardando sua conferência</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">{preparedSupplier.supplier_name}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={preparedSupplier.spreadsheet_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white"
                >
                  Abrir planilha para verificar
                </a>
                <button
                  type="button"
                  onClick={() => void confirmSupplierSheet()}
                  disabled={busy}
                  className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Marcar planilha como atualizada
                </button>
              </div>
            </div>
          ) : pendingSupplierFiles.length ? (
            showStandardizationSupplierSelector ? (
              <div className="mt-4 rounded-2xl border border-slate-200 p-5">
                <label className="block text-sm font-semibold text-slate-800">
                  Empresa
                  <select
                    value={selectedStandardizationSupplierId}
                    onChange={(event) => setSelectedStandardizationSupplierId(event.target.value)}
                    disabled={busy || standardizingSupplier}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100"
                  >
                    <option value="">Selecione...</option>
                    {pendingSupplierFiles.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => selectedStandardizationSupplier && void standardizeNextSupplier(selectedStandardizationSupplier.id)}
                  disabled={busy || standardizingSupplier || !selectedStandardizationSupplier}
                  className="mt-3 min-h-11 rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white disabled:bg-slate-300"
                >
                  {standardizingSupplier ? "Padronizando..." : "Padronizar e abrir planilha"}
                </button>
              </div>
            ) : null
          ) : (
            <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">
              Todas as planilhas de fornecedores estão atualizadas.
            </p>
          )}
        </section>
      ) : null}

      {data?.permissions.canReport ? (
        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">2. Fornecedor</p>
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
                      const mapping = (data.suppliers || []).find((item) =>
                        item.name.trim().toLocaleLowerCase("pt-BR") === supplier.name.trim().toLocaleLowerCase("pt-BR")
                      );
                      setSpreadsheetReference(mapping ? `https://docs.google.com/spreadsheets/d/${mapping.spreadsheet_id}/edit` : "");
                      setNote("");
                      setSourceSheetName(mapping?.sheet_name || "");
                      setSourceCodeColumn(mapping ? columnLetterFromIndex(mapping.code_column) : "B");
                      setSourceDescriptionColumn(mapping ? columnLetterFromIndex(mapping.description_column) : "C");
                      setSourceStockColumn(mapping ? columnLetterFromIndex(mapping.stock_column) : "F");
                      setSourceStartRow(mapping ? startRowFromRange(mapping.data_range) : "");
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
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">3. Itens do estoque</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Planilha do fornecedor</h2>
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

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <label className="text-sm font-semibold text-slate-800">
                Aba
                <input
                  value={sourceSheetName}
                  onChange={(event) => setSourceSheetName(event.target.value)}
                  placeholder={detectingSheet ? "Identificando..." : "Preencha somente se houver mais de uma aba"}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </label>
              <label className="text-sm font-semibold text-slate-800">
                Cod-venda
                <input
                  value={sourceCodeColumn}
                  onChange={(event) => setSourceCodeColumn(event.target.value.toUpperCase())}
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </label>
              <label className="text-sm font-semibold text-slate-800">
                Cod-compra <span className="font-normal text-slate-500">(opcional)</span>
                <input
                  value={sourcePurchaseCodeColumn}
                  onChange={(event) => setSourcePurchaseCodeColumn(event.target.value.toUpperCase())}
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
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={sourceStartRow}
                  onChange={(event) => setSourceStartRow(event.target.value.replace(/\D/g, ""))}
                  placeholder="Ex.: 6"
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                />
              </label>
            </div>

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
            <p className="mt-1 text-sm text-slate-500">Comparação entre o último estoque aprovado e o estoque filtrado agora.</p>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[1280px] border-collapse text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-3">Cod-venda</th>
                  <th className="px-3 py-3">Cod-compra</th>
                  <th className="px-3 py-3">Descrição</th>
                  <th className="px-3 py-3 text-right">Estoque anterior</th>
                  <th className="px-3 py-3 text-right">Estoque atual</th>
                  <th className="px-3 py-3 text-right">Diferença</th>
                  <th className="px-3 py-3">Resultado</th>
                  <th className="px-3 py-3">Ação</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => {
                  const difference = item.old_stock === null || item.situation === "nao_encontrado"
                    ? null
                    : item.new_stock - item.old_stock;
                  const needsReview = item.situation === "nao_encontrado" || difference !== 0;
                  const editing = editingConferenceItemId === item.id;
                  return (
                    <tr key={item.id} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-3 font-semibold text-blue-800">{item.code || item.source_sale_code || "—"}</td>
                      <td className="px-3 py-3 text-slate-700">{item.purchase_code || "—"}</td>
                      <td className="px-3 py-3 text-slate-700">{item.description || "—"}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-700">{item.old_stock ?? "—"}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-950">{item.new_stock}</td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-950">{signedDifference(difference)}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.situation === "nao_encontrado"
                            ? "bg-rose-100 text-rose-800"
                            : item.old_stock === null
                              ? "bg-slate-100 text-slate-700"
                              : difference === 0
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-900"
                        }`}>
                          {comparisonResult(item)}
                        </span>
                        {item.suggestion_reason ? (
                          <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">{item.suggestion_reason}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        {needsReview && data.permissions.canConference ? (
                          <div className="min-w-[220px]">
                            {!editing ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingConferenceItemId(item.id);
                                  setEditingSaleCode(item.suggested_code || item.code || item.source_sale_code || "");
                                  setEditingStock(String(item.new_stock));
                                }}
                                className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-800"
                              >
                                Editar
                              </button>
                            ) : (
                              <div className="space-y-2">
                                <label className="block text-xs font-semibold text-slate-700">
                                  COD-VENDA correto
                                  <input
                                    value={editingSaleCode}
                                    onChange={(event) => setEditingSaleCode(event.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                                  />
                                </label>
                                <label className="block text-xs font-semibold text-slate-700">
                                  Estoque físico
                                  <input
                                    inputMode="numeric"
                                    value={editingStock}
                                    onChange={(event) => setEditingStock(event.target.value.replace(/\D/g, ""))}
                                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                                  />
                                </label>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void saveConferenceItemCorrection(item)}
                                    className="rounded-lg bg-blue-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingConferenceItemId(null);
                                      setEditingSaleCode("");
                                      setEditingStock("");
                                    }}
                                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeId && data ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">4. Finalizar</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Atualizar Estoque Rotativo</h2>
          <p className="mt-2 text-sm text-slate-600">
            Itens encontrados passam de Pendente para Atualizado dd/mm/aa. Somente as divergências alteram a quantidade na coluna D.
          </p>

          {(data.items || []).some((item) => item.situation === "nao_encontrado") ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              Corrija os itens sem COD-VENDA confirmado antes de atualizar a planilha central.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void apply()}
              disabled={busy || (data.items || []).some((item) => item.situation === "nao_encontrado")}
              className="min-h-12 rounded-xl bg-emerald-700 px-6 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy ? "Atualizando..." : "Atualizar Estoque Rotativo"}
            </button>
          </div>
        </section>
      ) : null}

      {data?.history?.length ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Histórico</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Comparação entre períodos</h2>
          </div>
          <div className="mt-4 max-h-96 overflow-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Código</th>
                  <th className="px-3 py-3 text-right">Estoque anterior</th>
                  <th className="px-3 py-3 text-right">Estoque atual</th>
                  <th className="px-3 py-3 text-right">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-3 py-3 text-slate-700">{formatHistoryDate(item.recorded_at)}</td>
                    <td className="px-3 py-3 font-semibold text-blue-800">{item.code || "—"}</td>
                    <td className="px-3 py-3 text-right text-slate-700">{item.old_stock ?? "—"}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-950">{item.current_stock}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-950">{signedDifference(item.difference)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      {data?.permissions.canManage ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Planilhas de fornecedores</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Planilhas atualizadas</h2>
          </div>
          <div className="mt-4 space-y-2">
            {(data.supplierStandardizations || []).filter((item) => item.status === "atualizada").length ? (
              (data.supplierStandardizations || [])
                .filter((item) => item.status === "atualizada")
                .map((item) => (
                  <div key={item.spreadsheet_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{item.supplier_name}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.confirmed_at ? formatDate(item.confirmed_at) : ""}</p>
                    </div>
                    <a
                      href={item.spreadsheet_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-blue-800 underline"
                    >
                      Abrir planilha
                    </a>
                  </div>
                ))
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">Nenhuma planilha padronizada e confirmada ainda.</p>
            )}
          </div>
        </section>
      ) : null}

    </div>
  );
}
