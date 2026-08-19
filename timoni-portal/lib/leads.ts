import { google } from "googleapis";
import { getAccessTokenFromRefreshToken } from "@/lib/google-calendar";

export const LEADS_SPREADSHEET_ID = "1P2O9xhqyu7bMTythhZEPDEY8NYhh99hUthFQOaRCyK8";
export const LEADS_SHEET = "FOLLOW UP";

export type Lead = {
  row: number;
  cliente: string;
  segmento: string;
  contato: string;
  canal: string;
  ultimoContato: string;
  proximoContato: string;
  observacoes: string;
  status: "atrasado" | "hoje" | "proximo" | "sem-data";
};

async function sheetsClient() {
  const accessToken = await getAccessTokenFromRefreshToken();
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

function parsePtDate(value: string) {
  const clean = value.trim().replace(/^[a-zá-ú]{3}\.,\s*/i, "");
  const match = clean.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) return null;
  const yearRaw = match[3];
  const year = !yearRaw ? new Date().getFullYear() : Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);
  const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function leadStatus(value: string): Lead["status"] {
  const date = parsePtDate(value);
  if (!date) return "sem-data";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() < today.getTime()) return "atrasado";
  if (date.getTime() === today.getTime()) return "hoje";
  return "proximo";
}

export async function listLeads(): Promise<Lead[]> {
  const sheets = await sheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: LEADS_SPREADSHEET_ID,
    range: `'${LEADS_SHEET}'!A2:G1000`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  return (response.data.values ?? [])
    .map((r, index) => ({
      row: index + 2,
      cliente: String(r[0] ?? "").trim(),
      segmento: String(r[1] ?? "").trim(),
      contato: String(r[2] ?? "").trim(),
      canal: String(r[3] ?? "").trim(),
      ultimoContato: String(r[4] ?? "").trim(),
      proximoContato: String(r[5] ?? "").trim(),
      observacoes: String(r[6] ?? "").trim(),
      status: leadStatus(String(r[5] ?? "")),
    }))
    .filter((lead) => lead.cliente)
    .sort((a, b) => {
      const weight = { atrasado: 0, hoje: 1, "sem-data": 2, proximo: 3 } as const;
      return weight[a.status] - weight[b.status] || a.cliente.localeCompare(b.cliente, "pt-BR");
    });
}

export async function updateLeadFollowUp(input: { row: number; ultimoContato: string; proximoContato: string; observacoes: string }) {
  if (!Number.isInteger(input.row) || input.row < 2 || input.row > 1000) throw new Error("Linha inválida");
  const sheets = await sheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: LEADS_SPREADSHEET_ID,
    range: `'${LEADS_SHEET}'!E${input.row}:G${input.row}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[input.ultimoContato, input.proximoContato, input.observacoes]] },
  });
}
