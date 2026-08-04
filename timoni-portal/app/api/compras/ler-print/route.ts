import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;

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

function normalizeDate(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  return "";
}

function normalizeCompany(value: unknown) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  if (normalized.includes("MCR")) return "MCR";
  if (normalized.includes("ROD")) return "ROD";
  if (normalized.includes("CT") || normalized.includes("CASATIMONI")) return "CT";
  return "";
}

function normalizeOrderNumber(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/[^0-9A-Za-z-]/g, "")
    .toUpperCase();
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Sessão expirada. Entre novamente no Portal." },
      { status: 401 },
    );
  }

  if (!hasModuleAccess(session.user.email, "compras")) {
    return NextResponse.json(
      { error: "Acesso não autorizado ao módulo Compras." },
      { status: 403 },
    );
  }

  try {
    const formData = await request.formData();
    const image = formData.get("print");
    const supplierName = String(formData.get("supplierName") || "").trim();

    if (!(image instanceof File) || image.size === 0) {
      throw new Error("Cole ou selecione o print do pedido.");
    }
    if (!ALLOWED_TYPES.has(image.type)) {
      throw new Error("Use um print PNG, JPG ou WEBP.");
    }
    if (image.size > MAX_BYTES) {
      throw new Error("O print ultrapassa 8 MB. Faça uma captura menor.");
    }

    const cookieStore = await cookies();
    const apiKey =
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_AI_STUDIO_API_KEY?.trim() ||
      cookieStore.get("timoni_gemini_key")?.value?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          code: "GEMINI_NOT_CONFIGURED",
          error: "A leitura automática do print ainda não está configurada neste Portal.",
        },
        { status: 503 },
      );
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    const prompt = `
Leia este print de um pedido de compra da Casa Timoni.
Extraia somente os dados abaixo:
- numeroPedido: número exibido como PEDIDO DE COMPRA ou número do pedido;
- empresa: use somente MCR, ROD ou CT. Identifique pela razão social, logotipo, cabeçalho ou CNPJ da empresa emissora;
- dataEnvio: data do pedido, no formato AAAA-MM-DD;
- dataEntrega: previsão ou data de entrega, no formato AAAA-MM-DD;
- fornecedor: nome curto do fornecedor.

Regras:
1. Não invente dados.
2. Quando um campo não estiver visível, retorne string vazia.
3. A data em destaque como "Data de Entrega" deve ir em dataEntrega.
4. A data ao lado do número do pedido deve ir em dataEnvio.
5. Retorne exclusivamente JSON válido, sem markdown.

Fornecedor selecionado no Portal: ${supplierName || "não informado"}
Formato obrigatório:
{"numeroPedido":"","empresa":"","dataEnvio":"","dataEntrega":"","fornecedor":""}
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: image.type,
                    data: bytes.toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
          },
        }),
        cache: "no-store",
      },
    );

    const payload = await response.json();
    if (!response.ok) {
      const message =
        (payload as { error?: { message?: string } })?.error?.message ||
        "Não foi possível ler o print do pedido.";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const text = extractText(payload);
    if (!text) {
      throw new Error("A leitura do print terminou sem dados utilizáveis.");
    }

    const parsed = parseJson(text);
    const numeroPedido = normalizeOrderNumber(parsed.numeroPedido);
    const empresa = normalizeCompany(parsed.empresa);
    const dataEnvio = normalizeDate(parsed.dataEnvio);
    const dataEntrega = normalizeDate(parsed.dataEntrega);
    const fornecedor = String(parsed.fornecedor || "").trim();
    const baseTitle = supplierName || fornecedor;
    const suffix = `${numeroPedido}${empresa}`;
    const finalTitle = [baseTitle, suffix].filter(Boolean).join(" ").trim();

    if (!numeroPedido && !dataEnvio && !dataEntrega) {
      throw new Error("Não consegui identificar o número ou as datas no print. Faça uma captura mais nítida do cabeçalho.");
    }

    return NextResponse.json(
      {
        ok: true,
        numeroPedido,
        empresa,
        dataEnvio,
        dataEntrega,
        fornecedor,
        finalTitle,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível ler o print do pedido.",
      },
      { status: 400 },
    );
  }
}
