import { google } from "googleapis";
import { auth } from "@/lib/auth";
import { normalizeEmail } from "@/lib/access-control";
import { applyOfficialRotativoModel } from "@/lib/rotativo-official-model";
import { POST as legacyPOST } from "./route-legacy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  const copy = request.clone();
  const body = await copy.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action || "");
  const spreadsheetId = String(body.spreadsheetId || "").trim();
  const sheetName = String(body.sheetName || "").trim();

  const response = await legacyPOST(request);
  if (!response.ok) return response;

  if (action === "ajustar_a1" && spreadsheetId && sheetName) {
    const sheets = await sheetsClient();
    await applyOfficialRotativoModel(sheets, spreadsheetId, sheetName);
  }
  return response;
}
