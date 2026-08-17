"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

const TRELLO_URL = "https://trello.com/b/UfPrTr1H/compras";
const DRIVE_URL = "https://drive.google.com/drive/u/0/folders/1P7Nb1FwfSQ6e7TA9Wkgizyy53tGGQajk";
const STORAGE_KEY = "timoni_compras_portal_v4";

type Unit = "rio_claro" | "araras";
type Company = "MCR" | "RODINI" | "CT";

interface Summary {
  pedidosParaFazer: number;
  urgentes: number;
  enviadosRioClaro: number;
  enviadosAraras: number;
}

interface Supplier {
  id: string;
  name: string;
  url: string;
  urgent: boolean;
  unit: Unit | "nao_informada";
  labels: Array<{ id: string; name: string; color: string }>;
}

interface SentOrder {
  id: string;
  nome: string;
  url: string;
  enviadoEm: string;
  previsaoEntrega: string;
  unidade: Unit;
}

interface TrelloPayload {
  configured: boolean;
  boardName?: string;
  summary?: Summary;
  suppliers?: Supplier[];
  pedidosEnviados?: { rio_claro: SentOrder[]; araras: SentOrder[] };
  updatedAt?: string;
  error?: string;
}

function dateOnly(value: string) {
  if (!value) return "Sem data";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

interface PurchaseItem {
  codigo: string;
  descricao: string;
  quantidade: string;
}

function todayLocal() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function ComprasClient() {
  const [trello, setTrello] = useState<TrelloPayload>({ configured: false });
  const [loadingTrello, setLoadingTrello] = useState(true);
  const [selectedId, setSelectedId] = useState("");

  const [sheetUrl, setSheetUrl] = useState("");
  const [columnCode, setColumnCode] = useState("B");
  const [columnDescription, setColumnDescription] = useState("C");
  const [columnQuantity, setColumnQuantity] = useState("L");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [sheetInfo, setSheetInfo] = useState("");

  const [unit, setUnit] = useState<Unit | "">("");
  const [company, setCompany] = useState<Company>("MCR");
  const [finalTitle, setFinalTitle] = useState("");
  const [dataEnvio, setDataEnvio] = useState(todayLocal);
  const [dataEntrega, setDataEntrega] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatedCardUrl, setUpdatedCardUrl] = useState("");

  const suppliers = useMemo(() => trello.suppliers || [], [trello.suppliers]);
  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedId) || null,
    [selectedId, suppliers],
  );
  const summary = trello.summary;
  const canFinalize = Boolean(selectedSupplier && finalTitle.trim() && unit && dataEnvio && dataEntrega);

  const loadTrello = useCallback(async () => {
    setLoadingTrello(true);
    setError("");
    try {
      const response = await fetch("/api/compras", { cache: "no-store" });
      const payload = (await response.json()) as TrelloPayload;
      if (!response.ok) throw new Error(payload.error || "Não foi possível ler o Trello.");
      setTrello(payload);
      setSelectedId((current) =>
        current && !(payload.suppliers || []).some((supplier) => supplier.id === current) ? "" : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível ler o Trello.");
    } finally {
      setLoadingTrello(false);
    }
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as {
        sheetUrl?: string;
        columnCode?: string;
        columnDescription?: string;
        columnQuantity?: string;
        company?: Company;
      };
      if (saved.sheetUrl) setSheetUrl(saved.sheetUrl);
      if (saved.columnCode) setColumnCode(saved.columnCode);
      if (saved.columnDescription) setColumnDescription(saved.columnDescription);
      if (saved.columnQuantity) setColumnQuantity(saved.columnQuantity);
      if (saved.company) setCompany(saved.company);
    } catch {
      // Usa os padrões operacionais quando a configuração local estiver inválida.
    }
    void loadTrello();
  }, [loadTrello]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ sheetUrl, columnCode, columnDescription, columnQuantity, company }),
    );
  }, [sheetUrl, columnCode, columnDescription, columnQuantity, company]);

  function chooseSupplier(supplier: Supplier) {
    setSelectedId(supplier.id);
    setFinalTitle("");
    setUnit("");
    setError("");
    setSuccess("");
    setUpdatedCardUrl("");
  }

  async function extractItems() {
    setError("");
    setSuccess("");
    if (!sheetUrl.trim()) {
      setError("Cole o link da planilha usada para filtrar os itens do pedido.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/compras/extrair-planilha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: sheetUrl.trim(),
          codigo: columnCode.trim(),
          descricao: columnDescription.trim(),
          quantidade: columnQuantity.trim(),
        }),
      });
      const payload = await response.json();

      if (response.status === 401) {
        await signIn("google", { callbackUrl: "/dashboard/compras" });
        return;
      }
      if (!response.ok) throw new Error(payload?.error || "Não foi possível filtrar a planilha.");

      setItems(payload.items || []);
      setSheetInfo(`${payload.sheetTitle || "Aba"} · ${payload.totalItems || 0} itens`);
      setSuccess("Itens filtrados.");
    } catch (caught) {
      setItems([]);
      setSheetInfo("");
      setError(caught instanceof Error ? caught.message : "Não foi possível filtrar a planilha.");
    } finally {
      setBusy(false);
    }
  }

  function updateItem(index: number, field: keyof PurchaseItem, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    );
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function finalizePurchase() {
    setError("");
    setSuccess("");
    setUpdatedCardUrl("");

    if (!selectedSupplier) {
      setError("Selecione o fornecedor na lista de pedidos pendentes.");
      return;
    }
    if (!finalTitle.trim() || !unit || !dataEnvio || !dataEntrega) {
      setError("Informe o título final, a unidade, a data de envio e a previsão de entrega.");
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("cardId", selectedSupplier.id);
      formData.set("supplierName", selectedSupplier.name);
      formData.set("finalTitle", finalTitle.trim());
      formData.set("unit", unit);
      formData.set("empresa", company);
      formData.set("dataEnvio", dataEnvio);
      formData.set("dataEntrega", dataEntrega);
      formData.set("items", JSON.stringify(items));

      const response = await fetch("/api/compras/finalizar", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Não foi possível atualizar o Trello.");

      setSuccess("Pronto!");
      setUpdatedCardUrl(payload.cardUrl || "");
      setSelectedId("");
      setFinalTitle("");
      setUnit("");
      setDataEntrega("");
      await loadTrello();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível finalizar o pedido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Módulo operacional</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Compras</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Escolha o fornecedor uma vez, filtre itens quando precisar e finalize o pedido.
            </p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            Fluxo rápido
          </span>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Pedidos para fazer", summary?.pedidosParaFazer],
          ["Urgentes", summary?.urgentes],
          ["Enviados — Rio Claro", summary?.enviadosRioClaro],
          ["Enviados — Araras", summary?.enviadosAraras],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-3xl font-semibold text-slate-950">{loadingTrello ? "…" : value ?? "—"}</p>
            <p className="mt-2 text-sm text-slate-600">{label}</p>
          </article>
        ))}
      </section>

      {!trello.configured && !loadingTrello && (
        <section className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-xl font-semibold text-slate-950">Conectar o Trello</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            A conexão será mantida pelo Portal e usada para ler, atualizar e mover os cartões.
          </p>
          <Link
            href="/dashboard/compras/configurar"
            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white"
          >
            Configurar Trello
          </Link>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">1. Fornecedor</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Pedidos pendentes</h2>
              <p className="mt-1 text-sm text-slate-500">Clique uma vez no fornecedor que será atualizado.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadTrello()}
              disabled={loadingTrello}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50"
            >
              Atualizar
            </button>
          </div>

          {trello.configured && (
            <div className="mt-4 max-h-96 overflow-y-auto rounded-2xl border border-slate-200">
              {suppliers.length ? (
                suppliers.map((supplier) => {
                  const selected = selectedId === supplier.id;
                  return (
                    <button
                      type="button"
                      key={supplier.id}
                      onClick={() => chooseSupplier(supplier)}
                      className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 ${
                        selected ? "bg-blue-50 text-blue-900" : "bg-white text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      <span className="font-semibold">{supplier.name}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {selected && (
                          <span className="rounded-full bg-blue-700 px-2 py-0.5 text-[11px] font-semibold text-white">
                            Selecionado
                          </span>
                        )}
                        {supplier.urgent && (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                            Urgente
                          </span>
                        )}
                        {supplier.unit !== "nao_informada" && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {supplier.unit === "araras" ? "Araras" : "Rio Claro"}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="p-5 text-sm text-slate-500">Nenhum cartão em PEDIDOS PENDENTES.</p>
              )}
            </div>
          )}

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
              href={DRIVE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white"
            >
              Abrir pasta de fornecedores
            </a>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">2. Itens do pedido · opcional</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Planilha do pedido</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Funciona de forma independente. Padrão atual: código B, descrição C e quantidade L.
          </p>

          <label className="mt-4 block text-sm font-semibold text-slate-800">
            Link do Google Sheets
            <input
              type="url"
              value={sheetUrl}
              onChange={(event) => setSheetUrl(event.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-blue-600"
            />
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-semibold text-slate-800">
              Código
              <input
                value={columnCode}
                onChange={(event) => setColumnCode(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Descrição
              <input
                value={columnDescription}
                onChange={(event) => setColumnDescription(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Quantidade
              <input
                value={columnQuantity}
                onChange={(event) => setColumnQuantity(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void extractItems()}
            disabled={busy}
            className="mt-4 min-h-12 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-slate-300"
          >
            {busy ? "Filtrando..." : "Filtrar itens do pedido"}
          </button>
          {sheetInfo && <p className="mt-3 text-sm font-semibold text-emerald-700">{sheetInfo}</p>}
        </article>
      </section>

      {items.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Itens filtrados</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Total: {items.length} itens · Pedido: {company}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Confira e ajuste manualmente quando necessário.</p>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-3">Código</th>
                  <th className="px-3 py-3">Descrição</th>
                  <th className="px-3 py-3">Quantidade</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={`${item.codigo}-${index}`} className="border-t border-slate-100">
                    <td className="p-2">
                      <input
                        value={item.codigo}
                        onChange={(event) => updateItem(index, "codigo", event.target.value)}
                        className="min-h-10 w-36 rounded-lg border border-slate-200 px-3 font-semibold text-blue-800"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={item.descricao}
                        onChange={(event) => updateItem(index, "descricao", event.target.value)}
                        className="min-h-10 w-full min-w-80 rounded-lg border border-slate-200 px-3 text-slate-700"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={item.quantidade}
                        onChange={(event) => updateItem(index, "quantidade", event.target.value)}
                        className="min-h-10 w-28 rounded-lg border border-slate-200 px-3 text-right font-semibold text-slate-900"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">3. Finalizar</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-950">Atualizar Trello</h2>
        <p className="mt-2 text-sm text-slate-600">
          O fornecedor já foi escolhido. Informe agora os dados finais do pedido.
        </p>

        <label className="mt-4 block text-sm font-semibold text-slate-800">
          Título final do cartão
          <input
            value={finalTitle}
            onChange={(event) => setFinalTitle(event.target.value)}
            placeholder="Ex.: ROMPLAS 6055MCR"
            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm"
          />
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="text-sm font-semibold text-slate-800">
            Empresa
            <select
              value={company}
              onChange={(event) => setCompany(event.target.value as Company)}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
            >
              <option value="MCR">MCR</option>
              <option value="RODINI">RODINI</option>
              <option value="CT">CT</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Unidade
            <select
              value={unit}
              onChange={(event) => setUnit(event.target.value as Unit | "")}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
            >
              <option value="">Escolha</option>
              <option value="rio_claro">Rio Claro</option>
              <option value="araras">Araras</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Envio
            <input
              type="date"
              value={dataEnvio}
              onChange={(event) => setDataEnvio(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Entrega
            <input
              type="date"
              value={dataEntrega}
              onChange={(event) => setDataEntrega(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
            />
          </label>
        </div>

        {!canFinalize && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {!selectedSupplier
              ? "Selecione o fornecedor na lista de pedidos pendentes."
              : !finalTitle.trim()
                ? "Falta informar o título final do cartão."
                : !unit
                  ? "Falta escolher a unidade."
                  : !dataEnvio
                    ? "Falta informar a data de envio."
                    : "Falta informar a previsão de entrega."}
          </p>
        )}

        <button
          type="button"
          onClick={() => void finalizePurchase()}
          disabled={busy || !canFinalize}
          className="mt-4 min-h-12 rounded-xl bg-emerald-700 px-6 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? "Atualizando..." : "Atualizar Trello"}
        </button>
      </section>

      {error && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">
          {error}
        </p>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
          <p>{success}</p>
          {updatedCardUrl && (
            <a href={updatedCardUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex underline">
              Abrir cartão atualizado
            </a>
          )}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Acompanhamento</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">Pedidos enviados</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadTrello()}
            disabled={loadingTrello}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50"
          >
            Atualizar lista
          </button>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {([
            ["rio_claro", "Rio Claro"],
            ["araras", "Araras"],
          ] as const).map(([key, label]) => {
            const orders = trello.pedidosEnviados?.[key] || [];
            return (
              <div key={key} className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                  <h3 className="font-semibold text-slate-950">{label}</h3>
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">{orders.length}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <a key={order.id} href={order.url || TRELLO_URL} target="_blank" rel="noreferrer" className="block px-4 py-3 hover:bg-blue-50">
                      <p className="font-semibold text-slate-900">{order.nome}</p>
                      <p className="mt-1 text-sm text-slate-500">Enviado: {dateOnly(order.enviadoEm)} · Entrega: {dateOnly(order.previsaoEntrega)}</p>
                    </a>
                  ))}
                  {!loadingTrello && !orders.length && <p className="px-4 py-5 text-sm text-slate-500">Nenhum pedido enviado.</p>}
                  {loadingTrello && <p className="px-4 py-5 text-sm text-slate-500">Atualizando...</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
