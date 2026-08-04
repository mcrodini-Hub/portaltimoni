import { auth } from "@/lib/auth";
import { hasModuleAccess } from "@/lib/access-control";
import {
  normalizeTrelloText,
  trelloFetch,
  TRELLO_BOARD_SHORT_LINK,
} from "@/lib/trello";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface TrelloList {
  id: string;
  name: string;
  closed?: boolean;
}

interface TrelloLabel {
  id: string;
  name: string;
  color?: string;
}

interface TrelloBoard {
  id: string;
  lists?: TrelloList[];
  labels?: TrelloLabel[];
}

interface TrelloCard {
  id: string;
  name: string;
  url?: string;
  idLabels?: string[];
}

type PurchaseItem = {
  codigo: string;
  descricao: string;
  quantidade: string;
};

async function authorize() {
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
  return null;
}

function hasAllTokens(value: string, tokens: string[]) {
  const normalized = normalizeTrelloText(value);
  return tokens.every((token) => normalized.includes(token));
}

function parseItems(value: FormDataEntryValue | null): PurchaseItem[] {
  if (typeof value !== "string") return [];
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => {
      const current = item as Partial<PurchaseItem>;
      return {
        codigo: String(current.codigo || "").trim(),
        descricao: String(current.descricao || "").trim(),
        quantidade: String(current.quantidade || "").trim(),
      };
    })
    .filter((item) => item.codigo && item.descricao && item.quantidade);
}

function formatBrazilianDate(value: string) {
  if (!value) return "NÃO INFORMADO";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function buildDescription(
  items: PurchaseItem[],
  dataEnvio: string,
  dataEntrega: string,
) {
  const lines = items.map(
    (item) => `${item.codigo} | ${item.descricao} | ${item.quantidade}`,
  );
  return [
    `Data de envio: ${formatBrazilianDate(dataEnvio)}`,
    `Previsão de entrega: ${formatBrazilianDate(dataEntrega)}`,
    `Total: ${items.length} itens`,
    "",
    ...lines,
    "",
    `[Atualizado pelo Portal Timoni em ${new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    })}]`,
  ].join("\n");
}

async function attachFile(cardId: string, file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return false;
  if (file.size > 10 * 1024 * 1024) {
    throw new Error(`${file.name}: o anexo ultrapassa 10 MB.`);
  }

  const trelloForm = new FormData();
  trelloForm.set("file", file, file.name);
  trelloForm.set("name", file.name);
  await trelloFetch(`/cards/${encodeURIComponent(cardId)}/attachments`, {
    method: "POST",
    body: trelloForm,
  });
  return true;
}

export async function POST(request: Request) {
  const unauthorized = await authorize();
  if (unauthorized) return unauthorized;

  try {
    const formData = await request.formData();
    const cardId = String(formData.get("cardId") || "").trim();
    const supplierName = String(formData.get("supplierName") || "").trim();
    const finalTitle = String(formData.get("finalTitle") || "").trim();
    const unit = String(formData.get("unit") || "rio_claro");
    const dataEnvio = String(formData.get("dataEnvio") || "").trim();
    const dataEntrega = String(formData.get("dataEntrega") || "").trim();
    const items = parseItems(formData.get("items"));
    const attachment = formData.get("attachment");
    const orderFile = formData.get("orderFile");

    if (!cardId || !supplierName) throw new Error("Selecione o fornecedor.");
    if (!finalTitle) throw new Error("Informe o título final do cartão, incluindo o número do pedido.");
    if (!dataEnvio) throw new Error("Informe a data de envio.");
    if (!dataEntrega) throw new Error("Informe a previsão de entrega.");
    if (!items.length) throw new Error("Extraia os itens da planilha antes de finalizar.");
    if (unit !== "rio_claro" && unit !== "araras") {
      throw new Error("Selecione Rio Claro ou Araras.");
    }

    const board = await trelloFetch<TrelloBoard>(`/boards/${TRELLO_BOARD_SHORT_LINK}`, {
      params: {
        fields: "name",
        lists: "open",
        list_fields: "name,closed",
        labels: "all",
        label_fields: "name,color",
      },
    });
    const destination = (board.lists || []).find((list) =>
      unit === "rio_claro"
        ? hasAllTokens(list.name, ["pedidos", "enviado", "rio", "claro"])
        : hasAllTokens(list.name, ["pedidos", "enviado", "araras"]),
    );
    if (!destination) {
      throw new Error(
        unit === "rio_claro"
          ? "Lista PEDIDOS ENVIADO RIO CLARO não encontrada."
          : "Lista PEDIDOS ENVIADO ARARAS não encontrada.",
      );
    }

    const card = await trelloFetch<TrelloCard>(`/cards/${encodeURIComponent(cardId)}`, {
      params: { fields: "name,url,idLabels" },
    });
    const description = buildDescription(items, dataEnvio, dataEntrega);
    const updatedCard = await trelloFetch<TrelloCard>(`/cards/${encodeURIComponent(cardId)}`, {
      method: "PUT",
      params: {
        name: finalTitle,
        desc: description,
        idList: destination.id,
        pos: "top",
        due: `${dataEntrega}T12:00:00-03:00`,
      },
    });

    let sentLabel = (board.labels || []).find(
      (label) => normalizeTrelloText(label.name || "") === "enviado",
    );
    if (!sentLabel) {
      sentLabel = await trelloFetch<TrelloLabel>("/labels", {
        method: "POST",
        params: {
          idBoard: board.id,
          name: "Enviado",
          color: "yellow",
        },
      });
    }
    if (sentLabel && !(card.idLabels || []).includes(sentLabel.id)) {
      await trelloFetch(`/cards/${encodeURIComponent(cardId)}/idLabels`, {
        method: "POST",
        params: { value: sentLabel.id },
      });
    }

    const printAdded = await attachFile(cardId, attachment);
    const orderFileAdded = await attachFile(cardId, orderFile);

    return NextResponse.json({
      ok: true,
      cardName: updatedCard.name || finalTitle,
      cardUrl: updatedCard.url || card.url || "",
      attachmentAdded: printAdded || orderFileAdded,
      printAdded,
      orderFileAdded,
      destination: destination.name,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível finalizar o pedido no Trello.",
      },
      { status: 400 },
    );
  }
}
