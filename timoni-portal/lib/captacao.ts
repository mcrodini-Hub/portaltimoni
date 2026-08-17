import { google } from "googleapis";
import { getAccessTokenFromRefreshToken } from "@/lib/google-calendar";

export const CAPTACAO_SHEET_ID = process.env.CAPTACAO_SHEET_ID || "1itTFBsjLGfjoSbAaPJ9xfHzVukUMkC4qqqFM66B0TGE";

export const LEAD_HEADERS = [
  "id",
  "nome",
  "telefone",
  "loja",
  "origem",
  "responsavel",
  "status",
  "proximoFollowUp",
  "observacao",
  "criadoEm",
  "criadoPor",
  "atualizadoEm",
] as const;

export const LOG_HEADERS = ["id", "leadId", "dataHora", "usuario", "acao", "detalhe"] as const;

export type LeadStatus = "NOVO" | "CONTATO" | "FOLLOW_UP" | "ORCAMENTO" | "NEGOCIACAO" | "GANHO" | "PERDIDO";

export type Lead = {
  id: string;
  nome: string;
  telefone: string;
  loja: string;
  origem: string;
  responsavel: string;
  status: LeadStatus;
  proximoFollowUp: string;
  observacao: string;
  criadoEm: string;
  criadoPor: string;
  atualizadoEm: string;
};

export type LeadLog = {
  id: string;
  leadId: string;
  dataHora: string;
  usuario: string;
  acao: string;
  detalhe: string;
};

async function getSheets() {
  const accessToken = await getAccessTokenFromRefreshToken();
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

async function ensureStructure() {
  const sheets = await getSheets();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: CAPTACAO_SHEET_ID });
  const existing = new Set((metadata.data.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean));
  const requests = [] as Array<{ addSheet: { properties: { title: string } } }>;
  if (!existing.has("Leads")) requests.push({ addSheet: { properties: { title: "Leads" } } });
  if (!existing.has("Log")) requests.push({ addSheet: { properties: { title: "Log" } } });
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: CAPTACAO_SHEET_ID, requestBody: { requests } });
  }

  const headerCheck = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: CAPTACAO_SHEET_ID,
    ranges: ["Leads!A1:L1", "Log!A1:F1"],
  });
  const leadHeader = headerCheck.data.valueRanges?.[0]?.values?.[0] || [];
  const logHeader = headerCheck.data.valueRanges?.[1]?.values?.[0] || [];
  const data: Array<{ range: string; values: string[][] }> = [];
  if (leadHeader.join("|") !== LEAD_HEADERS.join("|")) data.push({ range: "Leads!A1:L1", values: [Array.from(LEAD_HEADERS)] });
  if (logHeader.join("|") !== LOG_HEADERS.join("|")) data.push({ range: "Log!A1:F1", values: [Array.from(LOG_HEADERS)] });
  if (data.length) {
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: CAPTACAO_SHEET_ID, requestBody: { valueInputOption: "RAW", data } });
  }
  return sheets;
}

function rowsToLeads(rows: string[][]): Lead[] {
  return rows.map((r) => ({
    id: r[0] || "",
    nome: r[1] || "",
    telefone: r[2] || "",
    loja: r[3] || "",
    origem: r[4] || "",
    responsavel: r[5] || "",
    status: (r[6] || "NOVO") as LeadStatus,
    proximoFollowUp: r[7] || "",
    observacao: r[8] || "",
    criadoEm: r[9] || "",
    criadoPor: r[10] || "",
    atualizadoEm: r[11] || "",
  }));
}

export async function listLeads() {
  const sheets = await ensureStructure();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: CAPTACAO_SHEET_ID, range: "Leads!A2:L" });
  return rowsToLeads((res.data.values || []) as string[][]).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
}

export async function listLogs(limit = 300) {
  const sheets = await ensureStructure();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: CAPTACAO_SHEET_ID, range: "Log!A2:F" });
  const rows = (res.data.values || []) as string[][];
  return rows.slice(-limit).reverse().map((r): LeadLog => ({
    id: r[0] || "",
    leadId: r[1] || "",
    dataHora: r[2] || "",
    usuario: r[3] || "",
    acao: r[4] || "",
    detalhe: r[5] || "",
  }));
}

async function appendLog(sheets: Awaited<ReturnType<typeof getSheets>>, leadId: string, usuario: string, acao: string, detalhe = "") {
  const row = [crypto.randomUUID(), leadId, new Date().toISOString(), usuario, acao, detalhe];
  await sheets.spreadsheets.values.append({
    spreadsheetId: CAPTACAO_SHEET_ID,
    range: "Log!A:F",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

export async function createLead(input: Omit<Lead, "id" | "criadoEm" | "criadoPor" | "atualizadoEm" | "status"> & { status?: LeadStatus }, usuario: string) {
  const sheets = await ensureStructure();
  const now = new Date().toISOString();
  const lead: Lead = {
    id: crypto.randomUUID(),
    nome: input.nome.trim(),
    telefone: input.telefone.trim(),
    loja: input.loja,
    origem: input.origem,
    responsavel: input.responsavel,
    status: input.status || "NOVO",
    proximoFollowUp: input.proximoFollowUp || "",
    observacao: input.observacao || "",
    criadoEm: now,
    criadoPor: usuario,
    atualizadoEm: now,
  };
  await sheets.spreadsheets.values.append({
    spreadsheetId: CAPTACAO_SHEET_ID,
    range: "Leads!A:L",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[lead.id, lead.nome, lead.telefone, lead.loja, lead.origem, lead.responsavel, lead.status, lead.proximoFollowUp, lead.observacao, lead.criadoEm, lead.criadoPor, lead.atualizadoEm]] },
  });
  await appendLog(sheets, lead.id, usuario, "LEAD_CRIADO", `${lead.nome} · ${lead.loja} · ${lead.origem}`);
  return lead;
}

export async function registerAction(leadId: string, usuario: string, input: { acao: string; detalhe?: string; status?: LeadStatus; proximoFollowUp?: string; observacao?: string }) {
  const sheets = await ensureStructure();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: CAPTACAO_SHEET_ID, range: "Leads!A2:L" });
  const rows = (res.data.values || []) as string[][];
  const index = rows.findIndex((r) => r[0] === leadId);
  if (index < 0) throw new Error("Lead não encontrado.");
  const row = [...rows[index]];
  while (row.length < 12) row.push("");
  if (input.status) row[6] = input.status;
  if (input.proximoFollowUp !== undefined) row[7] = input.proximoFollowUp;
  if (input.observacao !== undefined) row[8] = input.observacao;
  row[11] = new Date().toISOString();
  const sheetRow = index + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: CAPTACAO_SHEET_ID,
    range: `Leads!A${sheetRow}:L${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
  const detalhe = input.detalhe || [input.status ? `Status: ${input.status}` : "", input.proximoFollowUp ? `Próximo: ${input.proximoFollowUp}` : ""].filter(Boolean).join(" · ");
  await appendLog(sheets, leadId, usuario, input.acao, detalhe);
  return rowsToLeads([row])[0];
}
