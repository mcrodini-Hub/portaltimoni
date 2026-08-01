"use client";

import { useCallback, useEffect, useState } from "react";

const EXTENSION_ID = "ffpecldfbicgidadimedcdpddaljkkgg";
const MIN_EXTENSION_VERSION = "1.1.0";
const DOWNLOAD_URL =
  "https://drive.google.com/uc?export=download&id=1AM0XXO7fIuMdVw-7YJVMjPbuIEV2XKqn";
const PLANILHA_URL =
  "https://docs.google.com/spreadsheets/d/1cESMTRx98e6AbY5vxPCcT7VrqYAbgH0xGUk87ybqHUo/edit";

type Counts = {
  emAberto: number;
  aguardandoCompra: number;
  aguardandoChegada: number;
  finalizadas: number;
};

type Summary = {
  geral: Counts;
  porUnidade: {
    rio_claro: Counts;
    araras: Counts;
  };
};

type ExtensionResponse = {
  success?: boolean;
  version?: string;
  summary?: Summary;
  error?: string;
};

type Availability = "checking" | "ready" | "unavailable" | "outdated";

const emptyCounts: Counts = {
  emAberto: 0,
  aguardandoCompra: 0,
  aguardandoChegada: 0,
  finalizadas: 0,
};

const emptySummary: Summary = {
  geral: { ...emptyCounts },
  porUnidade: {
    rio_claro: { ...emptyCounts },
    araras: { ...emptyCounts },
  },
};

function getRuntime() {
  return (
    globalThis as typeof globalThis & {
      chrome?: {
        runtime?: {
          sendMessage?: (
            extensionId: string,
            message: unknown,
            callback: (response?: ExtensionResponse) => void,
          ) => void;
          lastError?: { message?: string };
        };
      };
    }
  ).chrome?.runtime;
}

function sendExtensionMessage(action: string): Promise<ExtensionResponse> {
  return new Promise((resolve, reject) => {
    const runtime = getRuntime();
    if (!runtime?.sendMessage) {
      reject(new Error("Extensão indisponível."));
      return;
    }

    const timeout = window.setTimeout(() => {
      reject(new Error("A extensão não respondeu."));
    }, 3500);

    try {
      runtime.sendMessage(EXTENSION_ID, { action }, (response) => {
        window.clearTimeout(timeout);
        const lastError = runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message || "A extensão não respondeu."));
          return;
        }
        resolve(response || {});
      });
    } catch (error) {
      window.clearTimeout(timeout);
      reject(error instanceof Error ? error : new Error("Falha ao acessar a extensão."));
    }
  });
}

function versionAtLeast(current = "0", minimum = "0") {
  const a = current.split(".").map((item) => Number(item) || 0);
  const b = minimum.split(".").map((item) => Number(item) || 0);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const currentPart = a[index] || 0;
    const minimumPart = b[index] || 0;
    if (currentPart > minimumPart) return true;
    if (currentPart < minimumPart) return false;
  }

  return true;
}

const statusCards: Array<{ key: keyof Counts; label: string }> = [
  { key: "emAberto", label: "Necessidades em aberto" },
  { key: "aguardandoCompra", label: "Aguardando compra" },
  { key: "aguardandoChegada", label: "Compradas e aguardando chegada" },
  { key: "finalizadas", label: "Finalizadas" },
];

export default function EstoqueClient() {
  const [availability, setAvailability] = useState<Availability>("checking");
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [extensionVersion, setExtensionVersion] = useState<string>("");
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState("Verificando o módulo Estoque...");

  const refresh = useCallback(async () => {
    setAvailability("checking");
    setMessage("Atualizando informações...");

    try {
      const response = await sendExtensionMessage("GET_ESTOQUE_SUMMARY");
      if (!response.success || !response.summary) {
        throw new Error(response.error || "A extensão não respondeu corretamente.");
      }

      setExtensionVersion(response.version || "");
      setSummary(response.summary);

      if (!versionAtLeast(response.version, MIN_EXTENSION_VERSION)) {
        setAvailability("outdated");
        setMessage("Módulo Estoque não instalado ou desatualizado.");
        return;
      }

      setAvailability("ready");
      setMessage("Módulo Estoque conectado.");
    } catch {
      setAvailability("unavailable");
      setMessage("Módulo Estoque não instalado ou desatualizado.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function openModule() {
    setOpening(true);
    try {
      const response = await sendExtensionMessage("OPEN_ESTOQUE");
      if (!response.success) {
        throw new Error(response.error || "Não foi possível abrir o módulo.");
      }
      setAvailability("ready");
      setMessage("Módulo Estoque aberto na lateral.");
    } catch {
      setAvailability("unavailable");
      setMessage("Módulo Estoque não instalado ou desatualizado.");
    } finally {
      setOpening(false);
    }
  }

  const showInstall = availability === "unavailable" || availability === "outdated";
  const showNumbers = availability === "ready" || availability === "outdated";

  return (
    <div className="pb-10">
      <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Módulo Estoque
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Estoque CT
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Acompanhe as necessidades de Rio Claro e Araras e abra a lateral sem sair do Portal Timoni.
            </p>
          </div>

          <span className="w-fit rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            Extensão {extensionVersion || MIN_EXTENSION_VERSION}
          </span>
        </div>

        <div
          className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-medium ${
            showInstall
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-100 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={openModule}
            disabled={opening}
            className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
          >
            {opening ? "Abrindo..." : "Abrir módulo Estoque"}
          </button>

          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Atualizar informações
          </button>

          <a
            href={PLANILHA_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Abrir planilha do Estoque
          </a>

          {showInstall && (
            <a
              href={DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-amber-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-amber-700"
            >
              Instalar ou atualizar módulo Estoque
            </a>
          )}
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statusCards.map((card) => (
          <article key={card.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-3xl font-semibold text-slate-950">
              {showNumbers ? summary.geral[card.key] : "—"}
            </p>
            <p className="mt-2 text-sm leading-5 text-slate-500">{card.label}</p>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        {[
          ["Rio Claro", summary.porUnidade.rio_claro],
          ["Araras", summary.porUnidade.araras],
        ].map(([label, counts]) => {
          const unitCounts = counts as Counts;
          return (
            <article key={label as string} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">{label as string}</h2>
              <div className="mt-4 divide-y divide-slate-100">
                {statusCards.map((card) => (
                  <div key={card.key} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="text-slate-600">{card.label}</span>
                    <strong className="text-slate-950">
                      {showNumbers ? unitCounts[card.key] : "—"}
                    </strong>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
