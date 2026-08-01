import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILES_PER_GROUP = 8;
const MAX_TOTAL_BYTES = 4_200_000;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    pedido_numero: { type: "string" },
    fornecedor_curto: { type: "string" },
    fornecedor_nome: { type: "string" },
    data_pedido: { type: "string" },
    data_documento_fornecedor: { type: "string" },
    resumo_texto: { type: "string" },
    pontos_atencao: {
      type: "array",
      items: { type: "string" },
    },
    contagens: {
      type: "object",
      additionalProperties: false,
      properties: {
        itens_mcr: { type: "integer" },
        itens_fornecedor: { type: "integer" },
        precos_divergentes: { type: "integer" },
        outras_divergencias: { type: "integer" },
      },
      required: [
        "itens_mcr",
        "itens_fornecedor",
        "precos_divergentes",
        "outras_divergencias",
      ],
    },
    totais: {
      type: "object",
      additionalProperties: false,
      properties: {
        subtotal_mcr: { type: ["number", "null"] },
        subtotal_fornecedor: { type: ["number", "null"] },
        impostos_fornecedor: { type: ["number", "null"] },
        frete_fornecedor: { type: ["number", "null"] },
        desconto_fornecedor: { type: ["number", "null"] },
        total_fornecedor: { type: ["number", "null"] },
      },
      required: [
        "subtotal_mcr",
        "subtotal_fornecedor",
        "impostos_fornecedor",
        "frete_fornecedor",
        "desconto_fornecedor",
        "total_fornecedor",
      ],
    },
    condicoes: {
      type: "object",
      additionalProperties: false,
      properties: {
        pagamento_mcr: { type: "string" },
        pagamento_fornecedor: { type: "string" },
        entrega_mcr: { type: "string" },
        entrega_fornecedor: { type: "string" },
        frete_mcr: { type: "string" },
        frete_fornecedor: { type: "string" },
      },
      required: [
        "pagamento_mcr",
        "pagamento_fornecedor",
        "entrega_mcr",
        "entrega_fornecedor",
        "frete_mcr",
        "frete_fornecedor",
      ],
    },
    itens: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          pl: { type: "string" },
          codigo_mcr: { type: "string" },
          codigo_fornecedor_pedido_mcr: { type: "string" },
          codigo_fornecedor_documento: { type: "string" },
          descricao: { type: "string" },
          quantidade_mcr: { type: ["number", "null"] },
          quantidade_fornecedor: { type: ["number", "null"] },
          preco_mcr: { type: ["number", "null"] },
          preco_fornecedor: { type: ["number", "null"] },
          divergencias: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "preco",
                "quantidade",
                "codigo",
                "descricao",
                "item_faltante",
                "item_extra",
                "pareamento_incerto",
                "outra",
              ],
            },
          },
          observacao: { type: "string" },
        },
        required: [
          "pl",
          "codigo_mcr",
          "codigo_fornecedor_pedido_mcr",
          "codigo_fornecedor_documento",
          "descricao",
          "quantidade_mcr",
          "quantidade_fornecedor",
          "preco_mcr",
          "preco_fornecedor",
          "divergencias",
          "observacao",
        ],
      },
    },
  },
  required: [
    "pedido_numero",
    "fornecedor_curto",
    "fornecedor_nome",
    "data_pedido",
    "data_documento_fornecedor",
    "resumo_texto",
    "pontos_atencao",
    "contagens",
    "totais",
    "condicoes",
    "itens",
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
16. O resumo_texto deve ter no máximo 5 linhas e dizer o essencial: itens, diferenças, totais e principal ponto de atenção.
17. pontos_atencao deve conter somente o que exige decisão, sem repetir informação irrelevante.
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

async function fileToContent(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const base64 = bytes.toString("base64");

  if (file.type === "application/pdf") {
    return {
      type: "file",
      file: {
        data: base64,
        media_type: file.type,
        filename: file.name,
      },
    };
  }

  return {
    type: "image_url",
    image_url: {
      url: `data:${file.type};base64,${base64}`,
    },
  };
}

function extractText(payload: unknown) {
  const data = payload as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => part.text || "").join("").trim();
  }
  return "";
}

function parseJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente no Portal." }, { status: 401 });
  }

  try {
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
      throw new Error("Os arquivos ultrapassam 4,2 MB. Reduza o tamanho das imagens ou envie menos páginas por vez.");
    }

    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
    if (!apiKey) {
      return NextResponse.json(
        { error: "A análise automática ainda não está autenticada na Vercel." },
        { status: 503 },
      );
    }

    const content: Array<Record<string, unknown>> = [
      { type: "text", text: INSTRUCTIONS },
      { type: "text", text: "GRUPO 1 — PEDIDO MCR / RODINI (DOCUMENTO-BASE)" },
    ];

    for (const file of pedidoFiles) {
      content.push({ type: "text", text: `Arquivo do pedido-base: ${file.name}` });
      content.push(await fileToContent(file));
    }

    content.push({ type: "text", text: "GRUPO 2 — DOCUMENTO DO FORNECEDOR" });
    for (const file of fornecedorFiles) {
      content.push({ type: "text", text: `Arquivo do fornecedor: ${file.name}` });
      content.push(await fileToContent(file));
    }

    const gatewayResponse = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.6",
        temperature: 0,
        max_tokens: 12000,
        messages: [{ role: "user", content }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "conferencia_pedido",
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
        providerOptions: {
          gateway: {
            zeroDataRetention: true,
            disallowPromptTraining: true,
          },
        },
      }),
      cache: "no-store",
    });

    const gatewayPayload = await gatewayResponse.json();
    if (!gatewayResponse.ok) {
      const message =
        (gatewayPayload as { error?: { message?: string } })?.error?.message ||
        "Não foi possível analisar os documentos.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const text = extractText(gatewayPayload);
    if (!text) {
      return NextResponse.json(
        { error: "A análise terminou sem um resultado utilizável." },
        { status: 502 },
      );
    }

    const result = parseJson(text);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha inesperada na conferência.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
