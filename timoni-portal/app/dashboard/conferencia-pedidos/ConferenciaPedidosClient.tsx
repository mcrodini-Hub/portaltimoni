"use client";

import { useRef, useState } from "react";
import {
  type ConferenciaResult,
  downloadWorkbook,
} from "./xlsx";

const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_FILES = 8;
const MAX_TOTAL_BYTES = 4_200_000;

type FileGroup = "pedido" | "fornecedor";

type DropZoneProps = {
  title: string;
  description: string;
  files: File[];
  disabled: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
};

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DropZone({
  title,
  description,
  files,
  disabled,
  onAdd,
  onRemove,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function addFromList(list: FileList | null) {
    if (!list?.length) return;
    onAdd(Array.from(list));
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (!disabled && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onPaste={(event) => {
          if (disabled) return;
          const pasted = Array.from(event.clipboardData.items)
            .map((item) => item.getAsFile())
            .filter((file): file is File => Boolean(file));
          if (pasted.length) {
            event.preventDefault();
            onAdd(pasted);
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) addFromList(event.dataTransfer.files);
        }}
        className={`mt-4 cursor-pointer rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${
          dragging
            ? "border-cyan-500 bg-cyan-50"
            : "border-slate-300 bg-slate-50 hover:border-cyan-400 hover:bg-cyan-50/50"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={disabled}
          accept=".pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            addFromList(event.target.files);
            event.target.value = "";
          }}
        />
        <p className="font-semibold text-slate-800">
          Clique, arraste ou cole o print com Ctrl+V
        </p>
        <p className="mt-2 text-sm text-slate-500">
          PDF, JPG, PNG ou WEBP — inclusive foto de anotação manuscrita
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-400">{fileSize(file.size)}</p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(index);
                }}
                className="rounded-lg px-2 py-1 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function uniqueFiles(current: File[], incoming: File[]) {
  const seen = new Set(
    current.map((file) => `${file.name}|${file.size}|${file.lastModified}`),
  );
  const next = [...current];
  for (const file of incoming) {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (!seen.has(key)) {
      seen.add(key);
      next.push(file);
    }
  }
  return next;
}

async function optimizeImage(file: File) {
  if (!file.type.startsWith("image/") || file.size <= 1_100_000) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1900;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "imagem";
    return new File([blob], `${name}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

function money(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Não informado";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function ConferenciaPedidosClient() {
  const [pedidoFiles, setPedidoFiles] = useState<File[]>([]);
  const [fornecedorFiles, setFornecedorFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ConferenciaResult | null>(null);

  function addFiles(group: FileGroup, incoming: File[]) {
    setError("");
    const invalid = incoming.find((file) => !ACCEPTED_TYPES.has(file.type));
    if (invalid) {
      setError(`${invalid.name}: use PDF, JPG, PNG ou WEBP.`);
      return;
    }

    const setter = group === "pedido" ? setPedidoFiles : setFornecedorFiles;
    setter((current) => {
      const next = uniqueFiles(current, incoming);
      if (next.length > MAX_FILES) {
        setError(`Máximo de ${MAX_FILES} arquivos em cada grupo.`);
        return current;
      }
      return next;
    });
  }

  function removeFile(group: FileGroup, index: number) {
    const setter = group === "pedido" ? setPedidoFiles : setFornecedorFiles;
    setter((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submit() {
    setError("");
    setResult(null);

    if (!pedidoFiles.length || !fornecedorFiles.length) {
      setError("Envie o pedido MCR/Rodini e o documento do fornecedor.");
      return;
    }

    setLoading(true);
    setStatus("Preparando os documentos...");

    try {
      const [optimizedPedido, optimizedFornecedor] = await Promise.all([
        Promise.all(pedidoFiles.map(optimizeImage)),
        Promise.all(fornecedorFiles.map(optimizeImage)),
      ]);

      const totalBytes = [...optimizedPedido, ...optimizedFornecedor].reduce(
        (sum, file) => sum + file.size,
        0,
      );
      if (totalBytes > MAX_TOTAL_BYTES) {
        throw new Error(
          "Os arquivos ainda ultrapassam 4,2 MB. Reduza o PDF ou envie menos imagens por vez.",
        );
      }

      const formData = new FormData();
      optimizedPedido.forEach((file) => formData.append("pedido", file));
      optimizedFornecedor.forEach((file) => formData.append("fornecedor", file));

      setStatus("Lendo PDFs, prints, fotos e anotações manuscritas...");
      const response = await fetch("/api/conferencia-pedidos", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível concluir a conferência.");
      }

      const data = payload as ConferenciaResult;
      setResult(data);
      setStatus("Conferência concluída. A planilha foi gerada.");
      downloadWorkbook(data);
    } catch (caught) {
      setStatus("");
      setError(
        caught instanceof Error
          ? caught.message
          : "Falha inesperada durante a conferência.",
      );
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPedidoFiles([]);
    setFornecedorFiles([]);
    setResult(null);
    setError("");
    setStatus("");
  }

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DropZone
          title="1. Pedido MCR / Rodini"
          description="Documento-base da conferência. Pode ser PDF, foto, print ou anotação manuscrita."
          files={pedidoFiles}
          disabled={loading}
          onAdd={(files) => addFiles("pedido", files)}
          onRemove={(index) => removeFile("pedido", index)}
        />
        <DropZone
          title="2. Documento do fornecedor"
          description="Pedido, confirmação, orçamento, NF-e, print, foto ou documento manuscrito recebido."
          files={fornecedorFiles}
          disabled={loading}
          onAdd={(files) => addFiles("fornecedor", files)}
          onRemove={(index) => removeFile("fornecedor", index)}
        />
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={loading || !pedidoFiles.length || !fornecedorFiles.length}
          onClick={submit}
          className="min-h-12 rounded-xl bg-cyan-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? "Conferindo documentos..." : "Conferir e gerar Excel"}
        </button>
        {(pedidoFiles.length > 0 || fornecedorFiles.length > 0 || result) && (
          <button
            type="button"
            disabled={loading}
            onClick={reset}
            className="min-h-12 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Nova conferência
          </button>
        )}
        {status && <p className="text-sm font-medium text-slate-600">{status}</p>}
      </div>

      {result && (
        <section className="mt-7 rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Conferência concluída
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Pedido {result.pedido_numero || "não identificado"} — {result.fornecedor_curto || result.fornecedor_nome}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => downloadWorkbook(result)}
              className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Baixar Excel novamente
            </button>
          </div>

          <p className="mt-5 whitespace-pre-line rounded-2xl bg-slate-50 p-4 text-base leading-7 text-slate-700">
            {result.resumo_texto}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ResultCard label="Itens no pedido" value={String(result.contagens.itens_mcr)} />
            <ResultCard label="Itens do fornecedor" value={String(result.contagens.itens_fornecedor)} />
            <ResultCard label="Preços divergentes" value={String(result.contagens.precos_divergentes)} />
            <ResultCard label="Outras divergências" value={String(result.contagens.outras_divergencias)} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ResultCard label="Subtotal MCR" value={money(result.totais.subtotal_mcr)} />
            <ResultCard label="Subtotal fornecedor" value={money(result.totais.subtotal_fornecedor)} />
            <ResultCard label="Total fornecedor" value={money(result.totais.total_fornecedor)} />
          </div>

          <div className="mt-6">
            <h3 className="font-semibold text-slate-900">Pontos de atenção</h3>
            {result.pontos_atencao.length ? (
              <ol className="mt-3 space-y-2">
                {result.pontos_atencao.map((point, index) => (
                  <li
                    key={`${point}-${index}`}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
                  >
                    <span className="mr-2 font-semibold">{index + 1}.</span>
                    {point}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Nenhuma divergência relevante identificada.
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-xs font-medium text-slate-600">
            <span className="rounded-lg bg-yellow-100 px-3 py-2">
              Amarelo no Excel: preço unitário diferente
            </span>
            <span className="rounded-lg bg-orange-200 px-3 py-2">
              Laranja no Excel: demais divergências
            </span>
          </div>
        </section>
      )}
    </div>
  );
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </article>
  );
}
