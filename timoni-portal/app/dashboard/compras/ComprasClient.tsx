"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";

const TRELLO_URL = "https://trello.com/b/UfPrTr1H/compras";
const DRIVE_URL = "https://drive.google.com/drive/u/0/folders/1P7Nb1FwfSQ6e7TA9Wkgizyy53tGGQajk";
const STORAGE_KEY = "timoni_compras_portal_v1";

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
  unit: "rio_claro" | "araras" | "nao_informada";
  labels: Array<{ id: string; name: string; color: string }>;
}

interface TrelloPayload {
  configured: boolean;
  boardName?: string;
  summary?: Summary;
  suppliers?: Supplier[];
  updatedAt?: string;
  error?: string;
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

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function ComprasClient() {
  const [trello, setTrello] = useState<TrelloPayload>({ configured: false });
  const [loadingTrello, setLoadingTrello] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [columnCode, setColumnCode] = useState("A");
  const [columnDescription, setColumnDescription] = useState("B");
  const [columnQuantity, setColumnQuantity] = useState("AB");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [sheetInfo, setSheetInfo] = useState("");
  const [bessaniUrl, setBessaniUrl] = useState("");
  const [unit, setUnit] = useState<"rio_claro" | "araras">("rio_claro");
  const [finalTitle, setFinalTitle] = useState("");
  const [dataEnvio, setDataEnvio] = useState(todayLocal);
  const [dataEntrega, setDataEntrega] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updatedCardUrl, setUpdatedCardUrl] = useState("");

  const suppliers = useMemo(() => trello.suppliers || [], [trello.suppliers]);
  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedId) || null,
    [selectedId, suppliers],
  );

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as {
        sheetUrl?: string;
        columnCode?: string;
        columnDescription?: string;
        columnQuantity?: string;
        bessaniUrl?: string;
      };
      if (saved.sheetUrl) setSheetUrl(saved.sheetUrl);
      if (saved.columnCode) setColumnCode(saved.columnCode);
      if (saved.columnDescription) setColumnDescription(saved.columnDescription);
      if (saved.columnQuantity) setColumnQuantity(saved.columnQuantity);
      if (saved.bessaniUrl) setBessaniUrl(saved.bessaniUrl);
    } catch {
      // Ignora configuração local inválida e usa os padrões.
    }
    void loadTrello();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        sheetUrl,
        columnCode,
        columnDescription,
        columnQuantity,
        bessaniUrl,
      }),
    );
  }, [sheetUrl, columnCode, columnDescription, columnQuantity, bessaniUrl]);

  useEffect(() => {
    if (!selectedSupplier) return;
    if (selectedSupplier.unit === "araras") setUnit("araras");
    else setUnit("rio_claro");
    setFinalTitle(selectedSupplier.name);
    setItems([]);
    setSheetInfo("");
    setAttachment(null);
    setSuccess("");
    setUpdatedCardUrl("");
  }, [selectedSupplier]);

  async function loadTrello() {
    setLoadingTrello(true);
    setError("");
    try {
      const response = await fetch("/api/compras", { cache: "no-store" });
      const payload = (await response.json()) as TrelloPayload;
      if (!response.ok) throw new Error(payload.error || "Não foi possível ler o Trello.");
      setTrello(payload);
      if (selectedId && !(payload.suppliers || []).some((supplier) => supplier.id === selectedId)) {
        setSelectedId("");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível ler o Trello.");
    } finally {
      setLoadingTrello(false);
    }
  }

  async function extractItems() {
    setError("");
    setSuccess("");
    if (!sheetUrl.trim()) {
      setError("Cole o link da planilha do fornecedor.");
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
      if (!response.ok) throw new Error(payload?.error || "Não foi possível extrair a planilha.");
      setItems(payload.items || []);
      setSheetInfo(
        `${payload.sheetTitle || "Aba"} · ${payload.totalItems || 0} itens · quantidade: ${payload.quantityHeader || columnQuantity}`,
      );
      setSuccess("Itens extraídos. Confira a lista e siga para o Bessani.");
    } catch (caught) {
      setItems([]);
      setSheetInfo("");
      setError(caught instanceof Error ? caught.message : "Não foi possível extrair a planilha.");
    } finally {
      setBusy(false);
    }
  }

  async function finalizePurchase() {
    setError("");
    setSuccess("");
    setUpdatedCardUrl("");
    if (!selectedSupplier) {
      setError("Selecione o fornecedor.");
      return;
    }
    if (!items.length) {
      setError("Extraia os itens da planilha antes de finalizar.");
      return;
    }
    if (!finalTitle.trim() || !dataEnvio || !dataEntrega) {
      setError("Informe o título final, a data de envio e a previsão de entrega.");
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("cardId", selectedSupplier.id);
      formData.set("supplierName", selectedSupplier.name);
      formData.set("finalTitle", finalTitle.trim());
      formData.set("unit", unit);
      formData.set("dataEnvio", dataEnvio);
      formData.set("dataEntrega", dataEntrega);
      formData.set("items", JSON.stringify(items));
      if (attachment) formData.set("attachment", attachment, attachment.name);

      const response = await fetch("/api/compras/finalizar", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Não foi possível atualizar o Trello.");

      setSuccess(
        `Pronto: ${payload.cardName}. Movido para ${payload.destination}${
          payload.attachmentAdded ? " com anexo" : ""
        }.`,
      );
      setUpdatedCardUrl(payload.cardUrl || "");
      setAttachment(null);
      await loadTrello();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível finalizar o pedido.");
    } finally {
      setBusy(false);
    }
  }

  async function copySupplierMessage() {
    await navigator.clipboard.writeText(
      "Olá, segue pedido de compra. Aguardo retorno com a previsão de entrega. Obrigada, Ciça",
    );
    setSuccess("Mensagem copiada.");
  }

  function handleAttachment(event: ChangeEvent<HTMLInputElement>) {
    setAttachment(event.target.files?.[0] || null);
  }

  const summary = trello.summary;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Módulo operacional</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Compras</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Trello, planilha do fornecedor e finalização do cartão no mesmo fluxo. Não utiliza extensão do Chrome.
            </p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            Sem extensão
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
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-xl font-semibold text-slate-950">Conectar o Trello uma única vez</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            A conexão substitui a extensão e permite ler, atualizar, anexar e mover os cartões pelo Portal.
          </p>
          <Link
            href="/dashboard/compras/configurar"
            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white"
          >
            Configurar Trello
          </Link>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">1. Fornecedor</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Pedidos pendentes</h2>
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
                suppliers.map((supplier) => (
                  <button
                    type="button"
                    key={supplier.id}
                    onClick={() => setSelectedId(supplier.id)}
                    className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 ${
                      selectedId === supplier.id ? "bg-blue-50 text-blue-900" : "bg-white text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-semibold">{supplier.name}</span>
                    <span className="flex shrink-0 gap-1">
                      {supplier.urgent && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Urgente</span>
                      )}
                      {supplier.unit !== "nao_informada" && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {supplier.unit === "araras" ? "Araras" : "Rio Claro"}
                        </span>
                      )}
                    </span>
                  </button>
                ))
              ) : (
                <p className="p-5 text-sm text-slate-500">Nenhum cartão em PEDIDOS PENDENTES.</p>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <a href={TRELLO_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 px-4 text-sm font-semibold text-blue-800">
              Abrir Trello
            </a>
            <a href={DRIVE_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white">
              Abrir pasta de fornecedores
            </a>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">2. Planilha</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Extrair itens do pedido</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cole o link da planilha e informe o cabeçalho ou a letra de cada coluna.
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
              <input value={columnCode} onChange={(event) => setColumnCode(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Descrição
              <input value={columnDescription} onChange={(event) => setColumnDescription(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Quantidade
              <input value={columnQuantity} onChange={(event) => setColumnQuantity(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void extractItems()}
            disabled={busy}
            className="mt-4 min-h-12 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800 disabled:bg-slate-300"
          >
            {busy ? "Processando..." : "Extrair itens da planilha"}
          </button>
          {sheetInfo && <p className="mt-3 text-sm font-semibold text-emerald-700">{sheetInfo}</p>}
        </article>
      </section>

      {items.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">3. Itens extraídos</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">{items.length} itens</h2>
            </div>
          </div>
          <div className="mt-4 max-h-80 overflow-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3 text-right">Quantidade</th></tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={`${item.codigo}-${index}`} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-blue-800">{item.codigo}</td>
                    <td className="px-4 py-3 text-slate-700">{item.descricao}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{item.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">4. Bessani</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Lançar o pedido</h2>
          <label className="mt-4 block text-sm font-semibold text-slate-800">
            Link do Bessani
            <input
              type="url"
              value={bessaniUrl}
              onChange={(event) => setBessaniUrl(event.target.value)}
              placeholder="Cole o endereço usado para lançar pedidos"
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm"
            />
          </label>
          <a
            href={validHttpUrl(bessaniUrl) ? bessaniUrl : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!validHttpUrl(bessaniUrl)}
            className={`mt-4 inline-flex min-h-12 items-center rounded-xl px-6 text-sm font-semibold ${
              validHttpUrl(bessaniUrl) ? "bg-slate-900 text-white" : "cursor-not-allowed bg-slate-200 text-slate-500"
            }`}
          >
            Abrir Bessani
          </a>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">5. Finalizar</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Atualizar e mover o cartão</h2>
          <p className="mt-2 text-sm text-slate-600">
            O Portal grava os itens, aplica a etiqueta Enviado, move para o topo da lista correta e adiciona o anexo.
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
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-semibold text-slate-800">
              Unidade
              <select value={unit} onChange={(event) => setUnit(event.target.value as "rio_claro" | "araras")} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm">
                <option value="rio_claro">Rio Claro</option>
                <option value="araras">Araras</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Envio
              <input type="date" value={dataEnvio} onChange={(event) => setDataEnvio(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Entrega
              <input type="date" value={dataEntrega} onChange={(event) => setDataEntrega(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" />
            </label>
          </div>
          <label className="mt-4 block text-sm font-semibold text-slate-800">
            Anexo do pedido
            <input type="file" onChange={handleAttachment} className="mt-2 block w-full rounded-xl border border-slate-300 p-3 text-sm" />
          </label>
          {attachment && <p className="mt-2 text-xs text-slate-500">{attachment.name}</p>}
          <button
            type="button"
            onClick={() => void finalizePurchase()}
            disabled={busy || !selectedSupplier || !items.length}
            className="mt-4 min-h-12 rounded-xl bg-emerald-700 px-6 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? "Finalizando..." : "Finalizar no Trello"}
          </button>
        </article>
      </section>

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-950">Mensagem para o fornecedor</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Olá, segue pedido de compra. Aguardo retorno com a previsão de entrega. Obrigada, Ciça
            </p>
          </div>
          <button type="button" onClick={() => void copySupplierMessage()} className="min-h-11 rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white">
            Copiar mensagem
          </button>
        </div>
      </section>

      {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">{error}</p>}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
          <p>{success}</p>
          {updatedCardUrl && (
            <a href={updatedCardUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block underline">
              Abrir cartão atualizado
            </a>
          )}
        </div>
      )}
    </div>
  );
}
