import { google } from "googleapis";

export const COMUNICADOS_SPREADSHEET_ID = "1xR4DTaNKad0yfVdnww3KwSAmOcK61ZIbM-v4eX43sjQ";
export const COMUNICADOS_SHEET = "Comunicados";
export const COMUNICADOS_SHEET_ID = 1956041927;

export type ComunicadoUnidade = "geral" | "araras" | "rio claro";
export type ComunicadoStatus = "ativo" | "arquivado";

export type Comunicado = {
  id: string;
  createdAt: string;
  unit: ComunicadoUnidade;
  title: string;
  message: string;
  status: ComunicadoStatus;
  updatedAt: string;
};

function sheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

function parseRows(rows: string[][]): Comunicado[] {
  return rows
    .map((row) => ({
      id: row[0] ?? "",
      createdAt: row[1] ?? "",
      unit: (row[2] ?? "geral") as ComunicadoUnidade,
      title: row[3] ?? "",
      message: row[4] ?? "",
      status: (row[5] ?? "ativo") as ComunicadoStatus,
      updatedAt: row[6] ?? row[1] ?? "",
    }))
    .filter((item) => item.id && item.title && item.message)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function readRows(accessToken: string) {
  const sheets = sheetsClient(accessToken);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
    range: `${COMUNICADOS_SHEET}!A2:G500`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (response.data.values ?? []) as string[][];
}

export async function listComunicados(accessToken: string) {
  return parseRows(await readRows(accessToken));
}

export async function createComunicado(
  accessToken: string,
  input: { unit: ComunicadoUnidade; title: string; message: string },
) {
  const sheets = sheetsClient(accessToken);
  const now = new Date().toISOString();
  const id = `com-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
    range: `${COMUNICADOS_SHEET}!A:G`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[id, now, input.unit, input.title, input.message, "ativo", now]],
    },
  });
  return id;
}

async function findRow(accessToken: string, id: string) {
  const rows = await readRows(accessToken);
  const index = rows.findIndex((row) => row[0] === id);
  return index < 0 ? null : index + 2;
}

export async function updateComunicado(
  accessToken: string,
  id: string,
  input: Partial<Pick<Comunicado, "unit" | "title" | "message" | "status">>,
) {
  const rowNumber = await findRow(accessToken, id);
  if (!rowNumber) throw new Error("Comunicado não encontrado.");

  const current = (await listComunicados(accessToken)).find((item) => item.id === id);
  if (!current) throw new Error("Comunicado não encontrado.");

  const sheets = sheetsClient(accessToken);
  await sheets.spreadsheets.values.update({
    spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
    range: `${COMUNICADOS_SHEET}!C${rowNumber}:G${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        input.unit ?? current.unit,
        input.title ?? current.title,
        input.message ?? current.message,
        input.status ?? current.status,
        new Date().toISOString(),
      ]],
    },
  });
}

export async function deleteComunicado(accessToken: string, id: string) {
  const rowNumber = await findRow(accessToken, id);
  if (!rowNumber) throw new Error("Comunicado não encontrado.");
  const sheets = sheetsClient(accessToken);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: COMUNICADOS_SHEET_ID,
              dimension: "ROWS",
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });
}
