import { createHash, randomUUID } from "node:crypto";
import { google, type sheets_v4 } from "googleapis";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasModuleAccess, normalizeEmail } from "@/lib/access-control";
import { createChatMessage, ensureConversation } from "@/lib/internal-chat";
import { recordModuleUpdateSafely } from "@/lib/module-updates";
import {
  ROTATING_STOCK_CENTRAL,
  ROTATING_STOCK_EMAILS,
  acquireRotatingStockLock,
  attachSupplierToWaitingUpdates,
  createRotatingStockUpdate,
  findSupplier,
  finishConference,
  getRotatingStockSupplier,
  getRotatingStockUpdate,
  listConferenceItems,
  listExpiredHighlights,
  listRotatingStockData,
  markHighlightsCleared,
  resolveNotFoundItem,
  saveConference,
  saveSupplierMapping,
  type RotatingStockItem,
  type RotatingStockSupplier,
} from "@/lib/rotating-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MANAGEMENT_EMAILS = new Set<string>([ROTATING_STOCK_EMAILS.cica, ROTATING_STOCK_EMAILS.marcelo]);

function extractSpreadsheetId(value: string) {
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match?.[1]) return match[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(value.trim()) ? value.trim() : "";
}

function cleanCode(value: unknown) {
  return String(value ?? "").trim();
}

function integerStock(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) throw new Error(`${label}: o estoque deve ser um número inteiro igual ou maior que zero.`);
  const number = Number(text);
  if (!Number.isSafeInteger(number)) throw new Error(`${label}: estoque fora do limite aceito.`);
  return number;
}

function sourceRange(supplier: RotatingStockSupplier) {
  return `${supplier.sheet_name}!${supplier.data_range}`;
}

function fingerprint(sourceRows: unknown[][], targetRows: unknown[][]) {
  return createHash("sha256").update(JSON.stringify({ sourceRows, targetRows })).digest("hex");
}

async function context() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email || !hasModuleAccess(email, "estoque-rotativo", session?.portalUser)) throw new Error("Acesso não autorizado ao Estoque Rotativo.");
  if (!session?.accessToken || session.error === "RefreshAccessTokenError") throw new Error("Sessão expirada. Saia e entre novamente no Portal.");
  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: session.accessToken });
  return { email, sheets: google.sheets({ version: "v4", auth: oauth }) };
}

function requireRole(email: string, role: "report" | "conference" | "manage") {
  const manager = MANAGEMENT_EMAILS.has(email);
  if (role === "report" && (manager || email === ROTATING_STOCK_EMAILS.lucas)) return;
  if (role === "conference" && (manager || email === ROTATING_STOCK_EMAILS.carolina)) return;
  if (role === "manage" && manager) return;
  throw new Error("Seu acesso não permite esta ação.");
}

async function readComparedRows(sheets: sheets_v4.Sheets, supplier: RotatingStockSupplier) {
  const [source, target] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: supplier.spreadsheet_id,
      range: sourceRange(supplier),
      valueRenderOption: "FORMATTED_VALUE",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
      range: `${ROTATING_STOCK_CENTRAL.sheetName}!${ROTATING_STOCK_CENTRAL.range}`,
      valueRenderOption: "FORMATTED_VALUE",
    }),
  ]);
  return {
    sourceRows: (source.data.values || []) as unknown[][],
    targetRows: (target.data.values || []) as unknown[][],
  };
}

function firstDataRow(range: string) {
  const match = range.match(/[A-Z]+(\d+)/i);
  return Number(match?.[1] || 1);
}

function buildComparison(supplier: RotatingStockSupplier, sourceRows: unknown[][], targetRows: unknown[][]) {
  const targetByCode = new Map<string, { row: number; stock: number }>();
  const targetDuplicates = new Set<string>();
  for (let index = 0; index < targetRows.length; index += 1) {
    const code = cleanCode(targetRows[index]?.[0]);
    if (!code) continue;
    if (targetByCode.has(code)) targetDuplicates.add(code);
    targetByCode.set(code, { row: index + 2, stock: integerStock(targetRows[index]?.[2], `Base central, código ${code}`) });
  }
  if (targetDuplicates.size) throw new Error(`A base central possui códigos duplicados: ${[...targetDuplicates].slice(0, 10).join(", ")}.`);

  const sourceCodes = new Set<string>();
  const items: Omit<RotatingStockItem, "id" | "update_id" | "applied">[] = [];
  const startRow = firstDataRow(supplier.data_range);
  for (let index = 0; index < sourceRows.length; index += 1) {
    const row = sourceRows[index] || [];
    const code = cleanCode(row[supplier.code_column]);
    const description = String(row[supplier.description_column] ?? "").trim();
    const stockValue = row[supplier.stock_column];
    if (!code && !description && String(stockValue ?? "").trim() === "") continue;
    if (!code) throw new Error(`Linha ${startRow + index}: código vazio.`);
    if (sourceCodes.has(code)) throw new Error(`Código duplicado na planilha do fornecedor: ${code}.`);
    sourceCodes.add(code);
    const newStock = integerStock(stockValue, `Linha ${startRow + index}, código ${code}`);
    const target = targetByCode.get(code);
    const situation = !target ? "nao_encontrado" : target.stock === newStock ? "sem_alteracao" : "encontrado";
    items.push({
      source_row: startRow + index,
      target_row: target?.row ?? null,
      code,
      description,
      old_stock: target?.stock ?? null,
      new_stock: newStock,
      situation,
    });
  }
  if (!items.length) throw new Error("A planilha não possui itens válidos no intervalo configurado.");
  return items;
}

async function centralSheetId(sheets: sheets_v4.Sheets) {
  const response = await sheets.spreadsheets.get({ spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId, fields: "sheets.properties" });
  const sheet = response.data.sheets?.find((item) => item.properties?.title === ROTATING_STOCK_CENTRAL.sheetName);
  if (sheet?.properties?.sheetId === undefined || sheet.properties.sheetId === null) throw new Error("Aba Produtos não encontrada na planilha central.");
  return sheet.properties.sheetId;
}

async function clearExpiredHighlights(sheets: sheets_v4.Sheets) {
  const expired = await listExpiredHighlights();
  if (!expired.length) return;
  const sheetId = await centralSheetId(sheets);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
    requestBody: {
      requests: expired.map((item) => ({
        repeatCell: {
          range: { sheetId, startRowIndex: item.target_row - 1, endRowIndex: item.target_row, startColumnIndex: 3, endColumnIndex: 4 },
          cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 1, blue: 1 } } },
          fields: "userEnteredFormat.backgroundColor",
        },
      })),
    },
  });
  await markHighlightsCleared(expired.map((item) => item.id));
}

function apiError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
  const permission = /insufficient|permission|forbidden|403/i.test(raw);
  const unauthorized = /não autorizado|não permite/i.test(raw);
  const message = permission ? "Sem acesso à planilha. Confirme o compartilhamento e entre novamente no Portal." : raw;
  return NextResponse.json({ ok: false, error: message }, { status: unauthorized || permission ? 403 : 400 });
}

export async function GET(request: Request) {
  try {
    const { email, sheets } = await context();
    await clearExpiredHighlights(sheets);
    const id = new URL(request.url).searchParams.get("id");
    const data = await listRotatingStockData();
    return NextResponse.json({
      ok: true,
      ...data,
      items: id ? await listConferenceItems(id) : [],
      currentUpdate: id ? await getRotatingStockUpdate(id) : null,
      permissions: {
        canReport: MANAGEMENT_EMAILS.has(email) || email === ROTATING_STOCK_EMAILS.lucas,
        canConference: MANAGEMENT_EMAILS.has(email) || email === ROTATING_STOCK_EMAILS.carolina,
        canManage: MANAGEMENT_EMAILS.has(email),
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { email, sheets } = await context();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");

    if (action === "registrar") {
      requireRole(email, "report");
      const supplierName = String(body.supplierName || "").trim();
      const spreadsheetReference = String(body.spreadsheetReference || "").trim();
      const note = String(body.note || "").trim();
      if (supplierName.length < 2) throw new Error("Informe o fornecedor ou grupo.");
      if (!spreadsheetReference) throw new Error("Informe o link ou nome da planilha.");
      const spreadsheetId = extractSpreadsheetId(spreadsheetReference);
      const supplier = await findSupplier(spreadsheetId, supplierName);
      const validated = Boolean(supplier?.validated_at);
      const id = randomUUID();
      await createRotatingStockUpdate({
        id,
        supplierId: validated ? supplier!.id : null,
        supplierName,
        spreadsheetName: spreadsheetReference.startsWith("http") ? supplierName : spreadsheetReference,
        spreadsheetLink: spreadsheetReference.startsWith("http") ? spreadsheetReference : "",
        note,
        reportedBy: email,
        status: validated ? "aguardando_conferencia" : "aguardando_mapeamento",
      });
      const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date());
      const conversation = await ensureConversation(ROTATING_STOCK_EMAILS.lucas, ROTATING_STOCK_EMAILS.carolina);
      await createChatMessage(conversation.id, ROTATING_STOCK_EMAILS.lucas, ROTATING_STOCK_EMAILS.carolina,
        `[Mensagem automática] ESTOQUE ROTATIVO\n\nNova relação de produtos disponível para atualização.\n\nPlanilha: ${spreadsheetReference}\nFornecedor: ${supplierName}\nInformado por: Lucas\nData: ${date}\n\nStatus: ${validated ? "Aguardando conferência" : "Aguardando validação do mapeamento"}.\n\nPor favor, verificar no módulo Estoque Rotativo.`);
      await recordModuleUpdateSafely("estoque-rotativo", email, `Nova relação: ${supplierName}.`, `estoque-rotativo:${id}`);
      return NextResponse.json({ ok: true, id, needsMapping: !validated });
    }

    if (action === "salvar_mapeamento") {
      requireRole(email, "manage");
      const name = String(body.name || "").trim();
      const spreadsheetId = extractSpreadsheetId(String(body.spreadsheetId || ""));
      const sheetName = String(body.sheetName || "").trim();
      const dataRange = String(body.dataRange || "").trim().toUpperCase();
      const columns = [body.codeColumn, body.descriptionColumn, body.stockColumn].map((value) => Number(value));
      if (!name || !spreadsheetId || !sheetName || !/^[A-Z]+\d+:[A-Z]+\d+$/.test(dataRange)) throw new Error("Revise fornecedor, planilha, aba e intervalo.");
      if (columns.some((value) => !Number.isInteger(value) || value < 0)) throw new Error("As colunas devem ser índices inteiros iniciados em zero.");
      if (new Set(columns).size !== 3) throw new Error("Código, descrição e estoque devem usar colunas diferentes.");
      const id = await saveSupplierMapping({
        id: body.id ? String(body.id) : undefined,
        name, spreadsheetId, sheetName, dataRange,
        codeColumn: columns[0], descriptionColumn: columns[1], stockColumn: columns[2], actor: email,
      });
      await attachSupplierToWaitingUpdates(id, spreadsheetId, name);
      return NextResponse.json({ ok: true, id });
    }

    if (action === "resolver_nao_encontrado") {
      requireRole(email, "conference");
      const itemId = String(body.itemId || "");
      if (!itemId || !(await resolveNotFoundItem(itemId, email))) throw new Error("Pendência não encontrada ou já resolvida.");
      return NextResponse.json({ ok: true });
    }

    const id = String(body.id || "");
    if (!id) throw new Error("Atualização não identificada.");
    const update = await getRotatingStockUpdate(id);
    if (!update) throw new Error("Atualização não encontrada.");
    if (!update.supplier_id) throw new Error("O mapeamento deste fornecedor ainda precisa ser validado pela gestão.");
    const supplier = await getRotatingStockSupplier(update.supplier_id);
    if (!supplier?.validated_at) throw new Error("O mapeamento deste fornecedor ainda não foi validado.");

    if (action === "conferir") {
      requireRole(email, "conference");
      if (update.status === "atualizado") throw new Error("Esta atualização já foi concluída.");
      if (!(await acquireRotatingStockLock(id, email))) throw new Error("Esta conferência está aberta por outro usuário. Tente novamente em alguns minutos.");
      const { sourceRows, targetRows } = await readComparedRows(sheets, supplier);
      const items = buildComparison(supplier, sourceRows, targetRows);
      await saveConference(id, email, fingerprint(sourceRows, targetRows), items);
      return NextResponse.json({ ok: true, items, fingerprint: fingerprint(sourceRows, targetRows) });
    }

    if (action === "atualizar") {
      requireRole(email, "conference");
      if (update.status !== "em_conferencia" || update.locked_by !== email) throw new Error("Reabra a conferência antes de atualizar.");
      const selectedIds = Array.isArray(body.selectedIds) ? body.selectedIds.map(String) : [];
      const storedItems = await listConferenceItems(id);
      const selected = storedItems.filter((item) => selectedIds.includes(item.id));
      if (!selected.length) throw new Error("Selecione ao menos um produto encontrado com alteração.");
      if (selected.some((item) => item.situation !== "encontrado" || !item.target_row)) throw new Error("A seleção contém item não atualizável.");
      const { sourceRows, targetRows } = await readComparedRows(sheets, supplier);
      if (fingerprint(sourceRows, targetRows) !== update.fingerprint) throw new Error("A planilha mudou durante a conferência. Recarregue a comparação e confirme novamente.");
      const sheetId = await centralSheetId(sheets);
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: selected.map((item) => ({ range: `${ROTATING_STOCK_CENTRAL.sheetName}!D${item.target_row}`, values: [[item.new_stock]] })),
        },
      });
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: ROTATING_STOCK_CENTRAL.spreadsheetId,
        requestBody: {
          requests: selected.map((item) => ({
            repeatCell: {
              range: { sheetId, startRowIndex: item.target_row! - 1, endRowIndex: item.target_row!, startColumnIndex: 3, endColumnIndex: 4 },
              cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.949, blue: 0.8 } } },
              fields: "userEnteredFormat.backgroundColor",
            },
          })),
        },
      });
      await finishConference(id, email, selected.map((item) => item.id), selected.map((item) => item.target_row!));
      await recordModuleUpdateSafely("estoque-rotativo", email, `${selected.length} estoques atualizados: ${update.supplier_name}.`, `estoque-rotativo:done:${id}`);
      return NextResponse.json({ ok: true, updated: selected.length });
    }

    throw new Error("Ação inválida.");
  } catch (error) {
    return apiError(error);
  }
}
