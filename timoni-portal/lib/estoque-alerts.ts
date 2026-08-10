import { google } from "googleapis";
import { getAccessTokenFromRefreshToken } from "@/lib/google-calendar";

const SPREADSHEET_ID = "1cESMTRx98e6AbY5vxPCcT7VrqYAbgH0xGUk87ybqHUo";
const SHEET_RANGE = "Necessidades!A2:O500";

export type StockAlert = {
  id: string;
  codigo: string;
  descricao: string;
  status: string;
  criadoEm: string;
  unidade: "rio_claro" | "araras";
  vendedor: string;
  quantidade: string;
};

function value(row: unknown[], index: number) {
  const current = row[index];
  return current === null || current === undefined ? "" : String(current);
}

function normalizeUnit(input: unknown): "rio_claro" | "araras" {
  return input === "araras" ? "araras" : "rio_claro";
}

async function getSheetsClient() {
  const accessToken = await getAccessTokenFromRefreshToken();
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

export async function listStockAlerts(): Promise<StockAlert[]> {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_RANGE,
    valueRenderOption: "FORMATTED_VALUE",
  });

  return ((response.data.values ?? []) as unknown[][])
    .map((row) => ({
      id: value(row, 0),
      codigo: value(row, 1),
      descricao: value(row, 2),
      status: value(row, 3) || "pendente",
      criadoEm: value(row, 4),
      unidade: normalizeUnit(row[10]),
      vendedor: value(row, 11),
      quantidade: value(row, 12),
    }))
    .filter((item) => item.id && item.status !== "chegou")
    .sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm));
}
