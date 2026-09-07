"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type ConferenciaResult, downloadWorkbook } from "./xlsx";

const ACCEPTED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const MAX_FILES = 16;
const MAX_TOTAL_BYTES = 4_200_000;

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function uniqueFiles(current: File[], incoming: File[]) {
  const seen = new Set(current.map((file) => `${file.name}|${file.size}|${file.lastModified}`));
  return [...current, ...incoming.filter((file) => {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })];
}

async function optimizeImage(file: File) {
  if (!file.type.startsWith("image/") || file.size <= 1_100_000) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1900 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "imagem"}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export default function ConferenciaPedidosClient() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ConferenciaResult | null>(null);
  const [geminiStatus, setGeminiStatus] = useState<"checking" | "ready" | "missing">("checking");

  const checkGemini = useCallback(async () => {
    try {
      const response = await fetch("/api/configurar-gemini", { cache: "no-store" });
      const payload = await response.json();
      const ready = Boolean(response.ok && payload?.configured);
      setGeminiStatus(ready ? "ready" : "missing");
      return ready;
    } catch {
      setGeminiStatus("missing");
      return false;
    }
  }, []);

  useEffect(() => {
    void checkGemini();
    const refresh = () => void checkGemini();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [checkGemini]);

  function addFiles(incoming: File[]) {
    setError("");
    const invalid = incoming.find((file) => !ACCEPTED_TYPES.has(file.type));
    if (invalid) return setError(`${invalid.name}: use PDF, JPG, PNG ou WEBP.`);
    setFiles((current) => {
      const next = uniqueFiles(current, incoming);
      if (next.length > MAX_FILES) {
        setError(`Máximo de ${MAX_FILES} arquivos por conferência.`);
        return current;
      }
      return next;
    });
  }

  async function submit() {
    setError("");
    setResult(null);
    if (files.length < 2) return setError("Insira pelo menos dois arquivos para comparar.");
    setStatus("Preparando documentos...");
    if (!(await checkGemini())) {
      setStatus("");
      return setError("A conferência precisa ser liberada uma única vez. Clique em Configurar agora.");
    }
    setLoading(true);
    try {
      const optimized = await Promise.all(files.map(optimizeImage));
      if (optimized.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) {
        throw new Error("Os arquivos ultrapassam 4,2 MB. Reduza o PDF ou envie menos imagens.");
      }
      const formData = new FormData();
      optimized.forEach((file) => formData.append("arquivos", file));
      setStatus("Conferindo documentos...");
      const response = await fetch("/api/conferencia-pedidos", { method: "POST", body: formData });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Não foi possível concluir a conferência.");
      const data = payload as ConferenciaResult;
      setResult(data);
      setStatus("Conferência concluída.");
      downloadWorkbook(data);
    } catch (caught) {
      setStatus("");
      setError(caught instanceof Error ? caught.message : "Falha inesperada durante a conferência.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFiles([]);
    setResult(null);
    setError("");
    setStatus("");
  }

  const disabled = loading || geminiStatus !== "ready";

  return (
    <div className="space-y-4">
      {geminiStatus === "missing" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
          <a href="/dashboard/conferencia-pedidos/configurar" target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">Configurar agora</a>
        </div>
      )}

      <section className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="text-xl text-blue-700">📎</div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-slate-950">Inserir arquivos</h2>
            <p className="mt-1 text-sm text-slate-500">Envie os documentos que serão conferidos.</p>
          </div>
        </div>

        <div role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(event) => { if (!disabled && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); inputRef.current?.click(); } }}
          onPaste={(event) => {
            if (disabled) return;
            const pasted = Array.from(event.clipboardData.items).map((item) => item.getAsFile()).filter((file): file is File => Boolean(file));
            if (pasted.length) { event.preventDefault(); addFiles(pasted); }
          }}
          onDragEnter={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
          onDrop={(event) => { event.preventDefault(); setDragging(false); if (!disabled) addFiles(Array.from(event.dataTransfer.files)); }}
          className={`mt-3 cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${dragging ? "border-blue-500 bg-blue-50" : "border-blue-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}>
          <input ref={inputRef} type="file" multiple disabled={disabled} accept=".pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { if (event.target.files) addFiles(Array.from(event.target.files)); event.target.value = ""; }} />
          <p className="font-semibold text-blue-700">Clique, arraste ou cole com Ctrl+V</p>
          <p className="mt-1 text-sm text-slate-500">PDF, JPG, PNG ou WEBP</p>
          <p className="mt-1 text-xs text-slate-400">inclusive foto de anotação manuscrita</p>
        </div>
      </section>

      <section className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-950">Arquivos adicionados</h2>
          <span className="text-sm font-medium text-slate-500">{files.length} arquivo(s)</span>
        </div>
        {files.length === 0 ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm text-slate-400">Nenhum arquivo selecionado.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {files.map((file, index) => (
              <div key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{file.name}</p><p className="text-xs text-slate-400">{fileSize(file.size)}</p></div>
                <button type="button" disabled={loading} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg px-2 py-1 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Remover</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</div>}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="button" disabled={disabled || files.length < 2} onClick={submit} className="w-full rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto">{loading ? "Conferindo documentos..." : "Conferir e gerar Excel"}</button>
        {(files.length > 0 || result) && <button type="button" disabled={loading} onClick={reset} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Nova conferência</button>}
        {status && <p className="text-sm font-medium text-slate-600">{status}</p>}
      </div>

      <section className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2"><span className="text-blue-700">ⓘ</span><h2 className="font-semibold text-blue-700">Informações</h2></div>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          <li>• Você pode enviar vários arquivos de uma vez.</li>
          <li>• Formatos aceitos: PDF, JPG, PNG e WEBP.</li>
          <li>• Após a conferência, será gerado um arquivo Excel com o resultado.</li>
        </ul>
      </section>

      {result && (
        <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Conferência concluída</p><h2 className="mt-1 font-semibold text-slate-950">Pedido {result.pedido_numero || "não identificado"} — {result.fornecedor_curto || result.fornecedor_nome}</h2></div>
            <button type="button" onClick={() => downloadWorkbook(result)} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Baixar Excel novamente</button>
          </div>
          <p className="mt-4 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{result.resumo_texto}</p>
          {result.pontos_atencao.length > 0 && <div className="mt-4"><h3 className="font-semibold text-rose-700">Pontos de atenção</h3><ol className="mt-2 space-y-1 text-sm text-slate-800">{result.pontos_atencao.map((point, index) => <li key={`${point}-${index}`}>{index + 1}. {point}</li>)}</ol></div>}
        </section>
      )}
    </div>
  );
}
