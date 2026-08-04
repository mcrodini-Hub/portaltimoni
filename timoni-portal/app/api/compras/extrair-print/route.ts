import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extractText(payload: unknown) {
  const data = payload as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
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

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeResult(value: Record<string, unknown>) {
  const rawItems = Array.isArray(value.items) ? value.items : [];
  const items = rawItems
    .map((entry) => {
      const item = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      return {
        codigo: cleanText(item.codigo),
        descricao: cleanText(item.descricao),
        quantidade: cleanText(item.quantidade),
      };
    })
    .filter((item) => item.codigo && item.descricao && item.quantidade && item.quantidade !== "0");

  const warnings = Array.isArray(value.avisos)
    ? value.avisos.map(cleanText).filter(Boolean).slice(0, 5)
    : [];

  return {
    items,
    totalItems: items.length,
    quantityHeader: cleanText(value.cabecalho_quantidade) || "Quantidade",
    warnings,
  };
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente no Portal." }, { status: 401 });
  }
  if (!hasModuleAccess(session.user.email, "compras")) {
    return NextResponse.json({ error: "Acesso não autorizado ao módulo Compras." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const image = formData.get("image");
    if (!(image instanceof File) || image.size === 0) {
      throw new Error("Cole ou selecione um print da planilha.");
    }
    if (!ALLOWED_TYPES.has(image.type)) {
      throw new Error("Formato não aceito. Use PNG, JPG ou WEBP.");
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
          error: "O Gemini ainda não está configurado neste navegador.",
        },
        { status: 503 },
      );
    }

    const monthLabel = new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    }).format(new Date());

    const bytes = Buffer.from(await image.arrayBuffer());
    const prompt = `
Você extrai itens de pedido de compra para a Casa Timoni a partir de um print de planilha.

OBJETIVO
Retorne somente código, descrição e quantidade do mês atual (${monthLabel}).

REGRAS
1. Leia todas as linhas visíveis do print, na ordem original.
2. Preserve os códigos como texto, inclusive zeros à esquerda.
3. Use a coluna de quantidade do mês atual. Se o nome do mês estiver cortado, use a última coluna visível que contenha as quantidades do pedido.
4. Ignore cabeçalhos, totais, subtotais, linhas vazias e linhas com quantidade vazia ou zero.
5. Não invente valores. Quando uma célula não estiver legível, não inclua a linha e registre um aviso curto.
6. Não use SKU/EAN como conceito adicional; copie exatamente o código exibido.
7. Retorne exclusivamente JSON válido, sem markdown, neste formato:
{"cabecalho_quantidade":"texto identificado","avisos":[],"items":[{"codigo":"","descricao":"","quantidade":""}]}
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
            maxOutputTokens: 8000,
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
        "Não foi possível analisar o print.";
      return NextResponse.json(
        {
          error:
            response.status === 429
              ? "A cota do Gemini foi atingida. Aguarde e tente novamente."
              : message,
        },
        { status: 502 },
      );
    }

    const text = extractText(payload);
    if (!text) throw new Error("O print foi analisado, mas nenhum resultado foi retornado.");

    const result = normalizeResult(parseJson(text));
    if (!result.items.length) {
      throw new Error("Não encontrei linhas completas com código, descrição e quantidade nesse print.");
    }

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível extrair o print." },
      { status: 400 },
    );
  }
}
