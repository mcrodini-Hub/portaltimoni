import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { normalizeEmail } from "@/lib/access-control";
import {
  attachSupplierToWaitingUpdates,
  getRotatingStockUpdate,
  listRotatingStockData,
  saveSupplierMapping,
} from "@/lib/rotating-stock";
import { GET as legacyGET, POST as legacyPOST } from "./route-legacy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = legacyGET;

function extractSpreadsheetId(value: string) {
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match?.[1]) return match[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(value.trim()) ? value.trim() : "";
}

async function sheetContext() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email || !session?.accessToken || session.error === "RefreshAccessTokenError") {
    throw new Error("Sessão expirada. Saia e entre novamente no Portal.");
  }
  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: session.accessToken });
  return { email, sheets: google.sheets({ version: "v4", auth: oauth }) };
}

async function alignRotativoUpdate(spreadsheetId: string, sheetName: string) {
  const { sheets } = await sheetContext();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheetId = metadata.data.sheets?.find((item) => item.properties?.title === sheetName)?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) throw new Error("A aba atualizada não foi encontrada.");

  const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const quoted = `'${sheetName.replace(/'/g, "''")}'`;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `${quoted}!A3`, values: [[`Estoque Rotativo atualizado em ${date}`]] },
        { range: `${quoted}!C2`, values: [[""]] },
      ],
    },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        repeatCell: {
          range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 1 },
          cell: { userEnteredFormat: {
            backgroundColor: { red: 1, green: 0.902, blue: 0.6 },
            textFormat: { fontFamily: "Calibri", fontSize: 10, bold: false, foregroundColor: { red: 0, green: 0, blue: 0 } },
            horizontalAlignment: "LEFT",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "OVERFLOW_CELL",
          } },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
        },
      }],
    },
  });
}

async function alignSupplierMapping(spreadsheetId: string, sheetName: string) {
  const { email } = await sheetContext();
  const snapshot = await listRotatingStockData();
  const supplier = snapshot.supplierStandardizations.find(
    (item) => item.spreadsheet_id === spreadsheetId && item.sheet_name === sheetName,
  );
  if (!supplier) throw new Error("Fornecedor padronizado não encontrado após a confirmação.");

  const mappingId = await saveSupplierMapping({
    name: supplier.supplier_name,
    spreadsheetId,
    sheetName,
    dataRange: "A8:D100000",
    codeColumn: 0,
    descriptionColumn: 2,
    stockColumn: 3,
    actor: email,
  });
  await attachSupplierToWaitingUpdates(mappingId, spreadsheetId, supplier.supplier_name, sheetName);
}

export async function POST(request: Request) {
  const copy = request.clone();
  const body = await copy.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action || "");
  const id = String(body.id || "").trim();
  const update = action === "atualizar" && id ? await getRotatingStockUpdate(id) : null;

  const response = await legacyPOST(request);
  if (!response.ok) return response;

  if (action === "atualizar" && update?.spreadsheet_link && update.source_sheet_name) {
    const spreadsheetId = extractSpreadsheetId(update.spreadsheet_link);
    if (spreadsheetId) await alignRotativoUpdate(spreadsheetId, update.source_sheet_name);
  }

  if (action === "confirmar_planilha_fornecedor") {
    const spreadsheetId = String(body.spreadsheetId || "").trim();
    const sheetName = String(body.sheetName || "").trim();
    if (spreadsheetId && sheetName) await alignSupplierMapping(spreadsheetId, sheetName);
  }

  return response;
}
