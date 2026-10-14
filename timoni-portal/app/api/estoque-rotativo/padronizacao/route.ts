import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { normalizeEmail } from "@/lib/access-control";
import { applyOfficialRotativoModel } from "@/lib/rotativo-official-model";
import { POST as legacyPOST } from "./route-legacy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROTATIVO_APPS_SCRIPT_URL = process.env.ROTATIVO_APPS_SCRIPT_URL
  || "https://script.google.com/macros/s/AKfycbzhImr2vK_yA3Szx8zgUwXAj19KF8KwSgD4lZlWWCSZpc0tKPYEsQjwym5qcM5WcKZgTQ/exec";
const ROTATIVO_TEMPLATE_SPREADSHEET_ID = "1zuQpzoqKs8oiJSENwAcVgyqQm0OJKLnkTWyNLCZwRus";

async function sheetsClient() {
  const session = await auth();
  const email = normalizeEmail(session?.user?.email);
  if (!email || !session?.accessToken || session.error === "RefreshAccessTokenError") {
    throw new Error("Sessão expirada. Saia e entre novamente no Portal.");
  }
  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: session.accessToken });
  return google.sheets({ version: "v4", auth: oauth });
}

async function invokeRotativoAppsScript(spreadsheetId: string, sheetName: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const url = new URL(ROTATIVO_APPS_SCRIPT_URL);
    url.searchParams.set("action", "padronizar");
    url.searchParams.set("spreadsheetId", spreadsheetId);
    url.searchParams.set("sheetName", sheetName);
    url.searchParams.set("templateSpreadsheetId", ROTATIVO_TEMPLATE_SPREADSHEET_ID);

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Apps Script respondeu HTTP ${response.status}.`);
    }
    return true;
  } catch (error) {
    // A padronização nativa do Portal continua sendo a fonte final de verdade.
    // O Apps Script é integrado como etapa complementar para manter o fluxo compatível no mobile.
    console.warn("[rotativo] Apps Script indisponível; aplicando modelo nativo do Portal.", error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const copy = request.clone();
  const body = await copy.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action || "");
  const spreadsheetId = String(body.spreadsheetId || "").trim();
  const sheetName = String(body.sheetName || "").trim();

  const response = await legacyPOST(request);
  if (!response.ok) return response;

  if (action === "ajustar_a1" && spreadsheetId && sheetName) {
    // Integra o Web App do Apps Script sem tornar o Portal dependente dele.
    // Em seguida o Portal reaplica o modelo oficial para garantir o mesmo resultado em web e mobile.
    await invokeRotativoAppsScript(spreadsheetId, sheetName);
    const sheets = await sheetsClient();
    await applyOfficialRotativoModel(sheets, spreadsheetId, sheetName);
  }
  return response;
}
