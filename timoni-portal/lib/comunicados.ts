import { google } from "googleapis";
import { getAccessTokenFromRefreshToken } from "@/lib/google-calendar";

export const COMUNICADOS_SPREADSHEET_ID = "1xR4DTaNKad0yfVdnww3KwSAmOcK61ZIbM-v4eX43sjQ";
export const COMUNICADOS_SHEET = "Comunicados";
export const COMUNICADOS_SHEET_ID = 1956041927;

export type ComunicadoUnidade = "geral" | "araras" | "rio claro";
export type ComunicadoStatus = "ativo" | "arquivado" | "excluido";

export type Comunicado = {
  id: string;
  createdAt: string;
  unit: ComunicadoUnidade;
  title: string;
  message: string;
  status: ComunicadoStatus;
  updatedAt: string;
  startsAt: string;
  expiresAt: string;
};

const LEGACY_COMUNICADOS: Comunicado[] = [
  {
    id: "legacy-painel-timoni",
    createdAt: "2026-08-17T12:00:00-03:00",
    unit: "geral",
    title: "Nova Ferramenta: Painel Timoni",
    message: "Esta é a nova comunicação interna da Casa Timoni. O Painel Timoni passa a concentrar avisos, comunicados, reuniões, aniversários, férias e informações importantes para a equipe.",
    status: "ativo",
    updatedAt: "2026-08-17T12:00:00-03:00",
    startsAt: "2026-08-17T12:00:00-03:00",
    expiresAt: "",
  },
  {
    id: "legacy-vendas-empresas",
    createdAt: "2026-08-17T12:01:00-03:00",
    unit: "rio claro",
    title: "Vendas Empresas",
    message: "As empresas relacionadas abaixo são atendidas exclusivamente por vendas internas. Todo atendimento, orçamento ou negociação destes clientes deve ser direcionado para Jaqueline.\n\nBrascabos\nCaprem\nCarbifibras\nChemson\nDelta\nEmbramaco\nFastenal\nJaw\nOwens Corning - Brasil GR\nPotencial\nRiclan\nRuy Rocha\nSanta Casa\nScoda\nTigre\nVillagres\nWhirlpool",
    status: "ativo",
    updatedAt: "2026-08-17T12:01:00-03:00",
    startsAt: "2026-08-17T12:01:00-03:00",
    expiresAt: "",
  },
];

async function sheetsClient(sessionAccessToken?: string) {
  const accessToken = sessionAccessToken || await getAccessTokenFromRefreshToken();
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
      startsAt: row[7] ?? row[1] ?? "",
      expiresAt: row[8] ?? "",
    }))
    .filter((item) => item.id && item.title && item.message)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function fetchRows(sessionAccessToken?: string) {
  const sheets = await sheetsClient(sessionAccessToken);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
    range: `${COMUNICADOS_SHEET}!A2:I500`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (response.data.values ?? []) as string[][];
}

async function readRows(accessToken?: string) {
  // No acesso da Ciça, usa primeiro a própria sessão autenticada. Para os
  // demais acessos, ou se a sessão não tiver permissão direta na planilha,
  // mantém a credencial persistente do Portal como alternativa.
  if (accessToken) {
    try {
      return await fetchRows(accessToken);
    } catch (error) {
      console.warn("[comunicados] leitura pela sessão falhou; usando credencial do Portal", error);
    }
  }
  return fetchRows();
}

export async function listComunicados(accessToken: string) {
  const stored = parseRows(await readRows(accessToken));
  const storedIds = new Set(stored.map((item) => item.id));
  return [...stored, ...LEGACY_COMUNICADOS.filter((item) => !storedIds.has(item.id))]
    .filter((item) => item.status !== "excluido")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function createComunicado(
  accessToken: string,
  input: { unit: ComunicadoUnidade; title: string; message: string; startsAt?: string; expiresAt?: string },
) {
  const sheets = await sheetsClient(accessToken);
  const now = new Date().toISOString();
  const id = `com-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
    range: `${COMUNICADOS_SHEET}!A:I`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[id, now, input.unit, input.title, input.message, "ativo", now, input.startsAt || now, input.expiresAt || ""]],
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
  input: Partial<Pick<Comunicado, "unit" | "title" | "message" | "status" | "startsAt" | "expiresAt">>,
) {
  const rowNumber = await findRow(accessToken, id);
  if (!rowNumber) {
    const legacy = LEGACY_COMUNICADOS.find((item) => item.id === id);
    if (!legacy) throw new Error("Comunicado não encontrado.");
    const sheets = await sheetsClient(accessToken);
    const now = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
      range: `${COMUNICADOS_SHEET}!A:I`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          legacy.id,
          legacy.createdAt,
          input.unit ?? legacy.unit,
          input.title ?? legacy.title,
          input.message ?? legacy.message,
          input.status ?? legacy.status,
          now,
          input.startsAt ?? legacy.startsAt,
          input.expiresAt ?? legacy.expiresAt,
        ]],
      },
    });
    return;
  }

  const current = (await listComunicados(accessToken)).find((item) => item.id === id);
  if (!current) throw new Error("Comunicado não encontrado.");

  const sheets = await sheetsClient(accessToken);
  await sheets.spreadsheets.values.update({
    spreadsheetId: COMUNICADOS_SPREADSHEET_ID,
    range: `${COMUNICADOS_SHEET}!C${rowNumber}:I${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        input.unit ?? current.unit,
        input.title ?? current.title,
        input.message ?? current.message,
        input.status ?? current.status,
        new Date().toISOString(),
        input.startsAt ?? current.startsAt,
        input.expiresAt ?? current.expiresAt,
      ]],
    },
  });
}

export async function deleteComunicado(accessToken: string, id: string) {
  const rowNumber = await findRow(accessToken, id);
  if (!rowNumber) {
    const legacy = LEGACY_COMUNICADOS.find((item) => item.id === id);
    if (!legacy) throw new Error("Comunicado não encontrado.");
    await updateComunicado(accessToken, id, { status: "excluido" });
    return;
  }
  const sheets = await sheetsClient(accessToken);
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
