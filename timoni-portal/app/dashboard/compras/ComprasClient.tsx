"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from "react";

const TRELLO_URL = "https://trello.com/b/UfPrTr1H/compras";
const DRIVE_URL = "https://drive.google.com/drive/u/0/folders/1P7Nb1FwfSQ6e7TA9Wkgizyy53tGGQajk";
const STORAGE_KEY = "timoni_compras_portal_v2";
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

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
  const [printFile, setPrintFile] = useState<File | null>(null);
  const [printPreview, setPrintPreview] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [printInfo, setPrintInfo] = useState("");
  const [printWarnings, setPrintWarnings] = useState<string[]>([]);
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
        bessaniUrl?: string;
      };
      if (saved.bessaniUrl) setBessaniUrl(saved.bessaniUrl);
    } catch {
      // Ignora configuração local inválida.
    }
    void loadTrello();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ bessaniUrl }));
  }, [bessaniUrl]);

  useEffect(() => {
    if (!printFile) {
      setPrintPreview("");
      return;
    }
    const url = URL.createObjectURL(printFile);
    setPrintPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [printFile]);

  useEffect(() => {
    if (!selectedSupplier) return;
    if (selectedSupplier.unit === "araras") setUnit("araras");
    else setUnit("rio_claro");
    setFinalTitle(selectedSupplier.name);
    setItems([]);
    setPrintFile(null);
    setPrintInfo("");
    setPrintWarnings([]);
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

  function validatePrint(file: File) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error("Use um print PNG, JPG ou WEBP.");
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new Error("O print ultrapassa 8 MB. Faça uma captura menor.");
    }
  }

  async function usePrint(file: File) {
    setError("");
    setSuccess("");
    try {
      validatePrint(file);
      setPrintFile(file);
      await extractItems(file);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível usar esse print.");
    }
  }

  async function extractItems(file = printFile) {
    setError("");
    setSuccess("");
    setPrintWarnings([]);
    if (!file) {
      setError("Cole ou selecione um print da planilha.");
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("image", file, file.name || "print-pedido.png");
      const response = await fetch("/api/compras/extrair-print", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Não foi possível extrair o print.");

      setItems(payload.items || []);
      setPrintInfo(
        `${payload.totalItems || 0} itens · quantidade: ${payload.quantityHeader || "coluna identificada"}`,
      );
      setPrintWarnings(payload.warnings || []);
      setSuccess("Itens extraídos do print. Confira a tabela antes de lançar no Bessani.");
    } catch (caught) {
      setItems([]);
      setPrintInfo("");
      setPrintWarnings([]);
      setError(caught instanceof Error ? caught.message : "Não foi possível extrair o print.");
    } finally {
      setBusy(false);
    }
  }

  function handlePrintPaste(event: ClipboardEvent<HTMLDivElement>) {
    const file = Array.from(event.clipboardData.files).find((entry) =>
      ALLOWED_IMAGE_TYPES.has(entry.type),
    );
    if (!file) {
      setError("A área de transferência não contém um print. Copie a imagem e pressione Ctrl+V novamente.");
      return;
    }
    event.preventDefault();
    const namedFile = new File([file], `print-pedido-${Date.now()}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"}`, {
      type: file.type,
    });
    void usePrint(namedFile);
  }

  function handlePrintDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files).find((entry) =>
      ALLOWED_IMAGE_TYPES.has(entry.type),
    );
    if (!file) {
      setError("Arraste um print PNG, JPG ou WEBP.");
      return;
    }
    void usePrint(file);
  }

  function handlePrintSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void usePrint(file);
    event.target.value = "";
  }

  function updateItem(index: number, field: keyof PurchaseItem, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
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
      setError("Selecione o fornecedor.");
      return;
    }
    if (!items.length) {
      setError("Extraia os itens do print antes de finalizar.");
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
              Trello, print da planilha, Bessani e finalização do cartão no mesmo fluxo. Não utiliza extensão do Chrome.
            </p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Sem extensão</span>
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
          <h2 className="text-xl font-semibold text-slate-950">Conectar o Trello uma única vez</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">A conexão substitui a extensão e permite ler, atualizar, anexar e mover os cartões pelo Portal.</p>
          <Link href="/dashboard/compras/configurar" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white">Configurar Trello</Link>
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">1. Fornecedor</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Pedidos pendentes</h2>
            </div>
            <button type="button" onClick={() => void loadTrello()} disabled={loadingTrello} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50">Atualizar</button>
          </div>

          {trello.configured && (
            <div className="mt-4 max-h-96 overflow-y-auto rounded-2xl border border-slate-200">
              {suppliers.length ? suppliers.map((supplier) => (
                <button
                  type="button"
                  key={supplier.id}
                  onClick={() => setSelectedId(supplier.id)}
                  className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 ${selectedId === supplier.id ? "bg-blue-50 text-blue-900" : "bg-white text-slate-800 hover:bg-slate-50"}`}
                >
                  <span className="font-semibold">{supplier.name}</span>
                  <span className="flex shrink-0 gap-1">
                    {supplier.urgent && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Urgente</span>}
                    {supplier.unit !== "nao_informada" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{supplier.unit === "araras" ? "Araras" : "Rio Claro"}</span>}
                  </span>
                </button>
              )) : <p className="p-5 text-sm text-slate-500">Nenhum cartão em PEDIDOS PENDENTES.</p>}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <a href={TRELLO_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 px-4 text-sm font-semibold text-blue-800">Abrir Trello</a>
            <a href={DRIVE_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white">Abrir pasta de fornecedores</a>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">2. Print da planilha</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Extrair itens do pedido</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Copie o print da planilha e cole abaixo com <strong>Ctrl+V</strong>. Também é possível arrastar ou selecionar a imagem.</p>

          <div
            tabIndex={0}
            onPaste={handlePrintPaste}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handlePrintDrop}
            className="mt-4 flex min-h-52 cursor-text flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 p-5 text-center outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
          >
            {printPreview ? (
              <>
                <img src={printPreview} alt="Print da planilha" className="max-h-48 max-w-full rounded-xl border border-blue-200 bg-white object-contain shadow-sm" />
                <p className="mt-3 text-sm font-semibold text-blue-900">{printFile?.name}</p>
                <p className="mt-1 text-xs text-blue-700">Cole outro print para substituir.</p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-blue-950">Clique aqui e pressione Ctrl+V</p>
                <p className="mt-2 text-sm text-blue-800">ou arraste o print para esta área</p>
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-blue-300 bg-white px-5 text-sm font-semibold text-blue-800 hover:bg-blue-50">
              Selecionar print
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePrintSelect} className="sr-only" />
            </label>
            {printFile && (
              <button type="button" onClick={() => void extractItems()} disabled={busy} className="min-h-11 rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white disabled:bg-slate-300">
                {busy ? "Lendo o print..." : "Ler novamente"}
              </button>
            )}
          </div>

          {busy && <p className="mt-3 text-sm font-semibold text-blue-800">Analisando código, descrição e quantidade...</p>}
          {printInfo && <p className="mt-3 text-sm font-semibold text-emerald-700">{printInfo}</p>}
          {printWarnings.length > 0 && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {printWarnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}
        </article>
      </section>

      {items.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">3. Itens extraídos</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">{items.length} itens</h2>
              <p className="mt-1 text-sm text-slate-500">Confira e corrija qualquer célula antes de continuar.</p>
            </div>
          </div>
          <div className="mt-4 max-h-96 overflow-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <tr><th className="px-3 py-3">Código</th><th className="px-3 py-3">Descrição</th><th className="px-3 py-3">Quantidade</th><th className="px-3 py-3"></th></tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={`${item.codigo}-${index}`} className="border-t border-slate-100">
                    <td className="p-2"><input value={item.codigo} onChange={(event) => updateItem(index, "codigo", event.target.value)} className="min-h-10 w-36 rounded-lg border border-slate-200 px-3 font-semibold text-blue-800" /></td>
                    <td className="p-2"><input value={item.descricao} onChange={(event) => updateItem(index, "descricao", event.target.value)} className="min-h-10 w-full min-w-80 rounded-lg border border-slate-200 px-3 text-slate-700" /></td>
                    <td className="p-2"><input value={item.quantidade} onChange={(event) => updateItem(index, "quantidade", event.target.value)} className="min-h-10 w-28 rounded-lg border border-slate-200 px-3 text-right font-semibold text-slate-900" /></td>
                    <td className="p-2 text-right"><button type="button" onClick={() => removeItem(index)} className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">Remover</button></td>
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
            <input type="url" value={bessaniUrl} onChange={(event) => setBessaniUrl(event.target.value)} placeholder="Cole o endereço usado para lançar pedidos" className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm" />
          </label>
          <a href={validHttpUrl(bessaniUrl) ? bessaniUrl : undefined} target="_blank" rel="noreferrer" aria-disabled={!validHttpUrl(bessaniUrl)} className={`mt-4 inline-flex min-h-12 items-center rounded-xl px-6 text-sm font-semibold ${validHttpUrl(bessaniUrl) ? "bg-slate-900 text-white" : "cursor-not-allowed bg-slate-200 text-slate-500"}`}>Abrir Bessani</a>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">5. Finalizar</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Atualizar e mover o cartão</h2>
          <p className="mt-2 text-sm text-slate-600">O Portal grava os itens, aplica a etiqueta Enviado, move para o topo da lista correta e adiciona o anexo.</p>

          <label className="mt-4 block text-sm font-semibold text-slate-800">
            Título final do cartão
            <input value={finalTitle} onChange={(event) => setFinalTitle(event.target.value)} placeholder="Ex.: ROMPLAS 6055MCR" className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm" />
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-semibold text-slate-800">Unidade<select value={unit} onChange={(event) => setUnit(event.target.value as "rio_claro" | "araras")} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"><option value="rio_claro">Rio Claro</option><option value="araras">Araras</option></select></label>
            <label className="text-sm font-semibold text-slate-800">Envio<input type="date" value={dataEnvio} onChange={(event) => setDataEnvio(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label>
            <label className="text-sm font-semibold text-slate-800">Entrega<input type="date" value={dataEntrega} onChange={(event) => setDataEntrega(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label>
          </div>
          <label className="mt-4 block text-sm font-semibold text-slate-800">Anexo do pedido<input type="file" onChange={handleAttachment} className="mt-2 block w-full rounded-xl border border-slate-300 p-3 text-sm" /></label>
          {attachment && <p className="mt-2 text-xs text-slate-500">{attachment.name}</p>}
          <button type="button" onClick={() => void finalizePurchase()} disabled={busy || !selectedSupplier || !items.length} className="mt-4 min-h-12 rounded-xl bg-emerald-700 px-6 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300">{busy ? "Finalizando..." : "Finalizar no Trello"}</button>
        </article>
      </section>

      <section className="rounded-3xl border border-blue-200 bg-blue-50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-950">Mensagem para o fornecedor</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">Olá, segue pedido de compra. Aguardo retorno com a previsão de entrega. Obrigada, Ciça</p>
          </div>
          <button type="button" onClick={() => void copySupplierMessage()} className="min-h-11 rounded-xl bg-blue-800 px-5 text-sm font-semibold text-white">Copiar mensagem</button>
        </div>
      </section>

      {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">{error}</p>}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
          <p>{success}</p>
          {updatedCardUrl && <a href={updatedCardUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block underline">Abrir cartão atualizado</a>}
        </div>
      )}
    </div>
  );
}
