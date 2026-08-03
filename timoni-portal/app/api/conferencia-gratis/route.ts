import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const MAX_FILES_PER_GROUP = 8;
const MAX_TOTAL_BYTES = 4_200_000;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_DIVERGENCES = new Set([
  "preco",
  "quantidade",
  "codigo",
  "descricao",
  "item_faltante",
  "item_extra",
  "pareamento_incerto",
  "outra",
]);

const RESPONSE_TEMPLATE = {
  pedido_numero: "",
  fornecedor_curto: "",
  fornecedor_nome: "",
  data_pedido: "",
  data_documento_fornecedor: "",
  resumo_texto: "",
  pontos_atencao: [""],
  contagens: {
    itens_mcr: 0,
    itens_fornecedor: 0,
    precos_divergentes: 0,
    outras_divergencias: 0,
  },
  totais: {
    subtotal_mcr: null,
    subtotal_fornecedor: null,
    impostos_fornecedor: null,
    frete_fornecedor: null,
    desconto_fornecedor: null,
    total_fornecedor: null,
  },
  condicoes: {
    pagamento_mcr: "",
    pagamento_fornecedor: "",
    entrega_mcr: "",
    entrega_fornecedor: "",
    frete_mcr: "",
    frete_fornecedor: "",
  },
  itens: [
    {
      pl: "",
      codigo_mcr: "",
      codigo_fornecedor_pedido_mcr: "",
      codigo_fornecedor_documento: "",
      descricao: "",
      quantidade_mcr: null,
      quantidade_fornecedor: null,
      preco_mcr: null,
      preco_fornecedor: null,
      divergencias: ["preco"],
      observacao: "",
    },
  ],
};

const INSTRUCTIONS = `
Você é o motor de conferência de pedidos da Casa Timoni.
Compare todos os arquivos do grupo PEDIDO MCR/RODINI com todos os arquivos do grupo DOCUMENTO DO FORNECEDOR.
Os arquivos podem ser PDFs, fotos, prints de tela ou imagens manuscritas. Leia também caligrafia e anotações feitas à mão.

REGRAS OBRIGATÓRIAS
1. O pedido MCR/Rodini é sempre o documento-base.
2. Leia todas as páginas, imagens, itens e anotações. Não omita linhas.
3. Não usamos SKU ou EAN como padrão de pareamento.
4. Pareie primeiro por "Cod. Forn. pedido MCR" e "Cod. Forn. fornecedor". Depois confirme pela descrição, medida, peso, volume, cor, embalagem e unidade. Use Cod. MCR e P-L como referências internas.
5. Não compare apenas pela ordem das linhas.
6. Preserve códigos como texto e mantenha zeros à esquerda.
7. Diferenças apenas de abreviação, acento, maiúsculas, espaços, pontos, traços ou zeros à esquerda não são divergência quando o produto estiver claramente identificado.
8. Quando o pareamento não for seguro, use "pareamento_incerto".
9. Item existente só no pedido MCR é "item_faltante". Item existente só no fornecedor é "item_extra".
10. Compare quantidades, preços unitários, subtotal, impostos, ST, IPI, frete, desconto, total, pagamento e entrega.
11. Recalcule somente o necessário para validar linhas e totais. Diferença acima de R$ 0,05 não deve ser tratada como arredondamento.
12. Não emita classificação APROVAR, REVISAR ou BLOQUEAR. Entregue fatos e divergências objetivas.
13. Use "NÃO INFORMADO" para texto ausente e null para valor numérico ausente.
14. Mantenha os itens na ordem do pedido MCR; itens extras do fornecedor ficam no final.
15. Em divergencias, use "preco" somente para preço unitário diferente. Use os demais códigos para todas as outras diferenças.
16. Os únicos códigos permitidos em divergencias são: preco, quantidade, codigo, descricao, item_faltante, item_extra, pareamento_incerto e outra.
17. O resumo_texto deve ter no máximo 5 linhas e dizer o essencial: itens, diferenças, totais e principal ponto de atenção.
18. pontos_atencao deve conter somente o que exige decisão, sem repetir informação irrelevante.
19. Retorne exclusivamente JSON válido, sem markdown, sem comentários e com todos os campos do modelo fornecido.
`;

function isFile(value: FormDataEntryValue): value is File {
  return typeof value !== "string";
}

function getFiles(formData: FormData, key: string) {
  return formData.getAll(key).filter(isFile).filter((file) => file.size > 0);
}

function validateFiles(files: File[], label: string) {
  if (!files.length) throw new Error(`Envie ao menos um arquivo em ${label}.`);
  if (files.length > MAX_FILES_PER_GROUP) {
    throw new Error(`${label}: máximo de ${MAX_FILES_PER_GROUP} arquivos.`);
  }
  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new Error(`${file.name}: formato não aceito. Use PDF, JPG, PNG ou WEBP.`);
    }
  }
}

async function fileToPart(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  return {
    inlineData: {
      mimeType: file.type,
      data: bytes.toString("base64"),
    },
  };
}

function extractText(payload: unknown) {
  const data = payload as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
}

function parseJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  return text || "NÃO INFORMADO";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const normalized = value
      .replace(/R\$/gi, "")
      .replace(/\s/g, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asInteger(value: unknown, fallback = 0) {
  const number = asNumber(value);
  return number === null ? fallback : Math.max(0, Math.round(number));
}

function normalizeResult(value: Record<string, unknown>) {
  const rawCounts = asObject(value.contagens);
  const rawTotals = asObject(value.totais);
  const rawConditions = asObject(value.condicoes);
  const rawItems = Array.isArray(value.itens) ? value.itens : [];

  const itens = rawItems.map((entry) => {
    const item = asObject(entry);
    const divergencias = Array.isArray(item.divergencias)
      ? item.divergencias
          .map((entryValue) => String(entryValue || "").trim())
          .filter((entryValue) => ALLOWED_DIVERGENCES.has(entryValue))
      : [];

    return {
      pl: asText(item.pl),
      codigo_mcr: asText(item.codigo_mcr),
      codigo_fornecedor_pedido_mcr: asText(item.codigo_fornecedor_pedido_mcr),
      codigo_fornecedor_documento: asText(item.codigo_fornecedor_documento),
      descricao: asText(item.descricao),
      quantidade_mcr: asNumber(item.quantidade_mcr),
      quantidade_fornecedor: asNumber(item.quantidade_fornecedor),
      preco_mcr: asNumber(item.preco_mcr),
      preco_fornecedor: asNumber(item.preco_fornecedor),
      divergencias,
      observacao: asText(item.observacao),
    };
  });

  const precosCalculados = itens.filter((item) => item.divergencias.includes("preco")).length;
  const outrasCalculadas = itens.filter((item) =>
    item.divergencias.some((entry) => entry !== "preco"),
  ).length;

  return {
    pedido_numero: asText(value.pedido_numero),
    fornecedor_curto: asText(value.fornecedor_curto),
    fornecedor_nome: asText(value.fornecedor_nome),
    data_pedido: asText(value.data_pedido),
    data_documento_fornecedor: asText(value.data_documento_fornecedor),
    resumo_texto: asText(value.resumo_texto),
    pontos_atencao: Array.isArray(value.pontos_atencao)
      ? value.pontos_atencao.map(asText).filter((entry) => entry !== "NÃO INFORMADO")
      : [],
    contagens: {
      itens_mcr: asInteger(rawCounts.itens_mcr, itens.filter((item) => !item.divergencias.includes("item_extra")).length),
      itens_fornecedor: asInteger(rawCounts.itens_fornecedor, itens.filter((item) => !item.divergencias.includes("item_faltante")).length),
      precos_divergentes: asInteger(rawCounts.precos_divergentes, precosCalculados),
      outras_divergencias: asInteger(rawCounts.outras_divergencias, outrasCalculadas),
    },
    totais: {
      subtotal_mcr: asNumber(rawTotals.subtotal_mcr),
      subtotal_fornecedor: asNumber(rawTotals.subtotal_fornecedor),
      impostos_fornecedor: asNumber(rawTotals.impostos_fornecedor),
      frete_fornecedor: asNumber(rawTotals.frete_fornecedor),
      desconto_fornecedor: asNumber(rawTotals.desconto_fornecedor),
      total_fornecedor: asNumber(rawTotals.total_fornecedor),
    },
    condicoes: {
      pagamento_mcr: asText(rawConditions.pagamento_mcr),
      pagamento_fornecedor: asText(rawConditions.pagamento_fornecedor),
      entrega_mcr: asText(rawConditions.entrega_mcr),
      entrega_fornecedor: asText(rawConditions.entrega_fornecedor),
      frete_mcr: asText(rawConditions.frete_mcr),
      frete_fornecedor: asText(rawConditions.frete_fornecedor),
    },
    itens,
  };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Sessão expirada. Entre novamente no Portal." },
      { status: 401 },
    );
  }

  if (!hasModuleAccess(session.user.email, "conferencia")) {
    return NextResponse.json(
      { error: "Acesso não autorizado a este módulo." },
      { status: 403 },
    );
  }

  try {
    const cookieStore = await cookies();
    const apiKey = cookieStore.get("timoni_gemini_key")?.value?.trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Configure primeiro a chave gratuita do Google AI Studio no botão Configurar análise gratuita.",
        },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const pedidoFiles = getFiles(formData, "pedido");
    const fornecedorFiles = getFiles(formData, "fornecedor");

    validateFiles(pedidoFiles, "Pedido MCR/Rodini");
    validateFiles(fornecedorFiles, "Documento do fornecedor");

    const totalBytes = [...pedidoFiles, ...fornecedorFiles].reduce(
      (sum, file) => sum + file.size,
      0,
    );
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error(
        "Os arquivos ultrapassam 4,2 MB. Reduza o tamanho das imagens ou envie menos páginas por vez.",
      );
    }

    const parts: Array<Record<string, unknown>> = [
      {
        text: `${INSTRUCTIONS}\n\nMODELO OBRIGATÓRIO DE RESPOSTA:\n${JSON.stringify(RESPONSE_TEMPLATE)}`,
      },
      { text: "GRUPO 1 — PEDIDO MCR / RODINI (DOCUMENTO-BASE)" },
    ];

    for (const file of pedidoFiles) {
      parts.push({ text: `Arquivo do pedido-base: ${file.name}` });
      parts.push(await fileToPart(file));
    }

    parts.push({ text: "GRUPO 2 — DOCUMENTO DO FORNECEDOR" });
    for (const file of fornecedorFiles) {
      parts.push({ text: `Arquivo do fornecedor: ${file.name}` });
      parts.push(await fileToPart(file));
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 12000,
            responseMimeType: "application/json",
          },
        }),
        cache: "no-store",
      },
    );

    const payload = await response.json();
    if (!response.ok) {
      const message =
        (payload as { error?: { message?: string; status?: string } })?.error?.message ||
        "Não foi possível analisar os documentos pelo Google Gemini.";
      const status =
        response.status === 429
          ? "A cota gratuita do Google foi atingida. Aguarde a renovação da cota e tente novamente."
          : message;
      return NextResponse.json({ error: status }, { status: 502 });
    }

    const text = extractText(payload);
    if (!text) {
      return NextResponse.json(
        { error: "A análise terminou sem um resultado utilizável." },
        { status: 502 },
      );
    }

    const result = normalizeResult(parseJson(text));
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha inesperada na conferência.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
