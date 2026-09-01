import { google } from "googleapis";
import type { sheets_v4 } from "googleapis";
import { getAccessTokenFromRefreshToken } from "@/lib/google-calendar";

export const LEADS_SPREADSHEET_ID = "1P2O9xhqyu7bMTythhZEPDEY8NYhh99hUthFQOaRCyK8";
export const LEADS_SHEET = "FOLLOW UP";
export const PROSPECTS_SOURCE_SHEET = "A PROSPECTAR";
export const PROSPECTS_PORTAL_SHEET = "PROSPECTAR PORTAL";
export const LEADS_HISTORY_SHEET = "HISTÓRICO LEADS";

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

export type Prospect = {
  id: string;
  cliente: string;
  segmento: string;
  cidade: string;
  contato: string;
  canal: string;
  oportunidade: string;
  observacoes: string;
  origem: "historico" | "portal";
};

async function sheetsClient(sessionAccessToken?: string) {
  const accessToken = sessionAccessToken || await getAccessTokenFromRefreshToken();
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

function parseDate(value: string) {
  const clean = value.trim().replace(/^[a-zá-ú]{3}\.,\s*/i, "");
  const iso = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    date.setHours(0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const match = clean.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) return null;
  const yearRaw = match[3];
  const year = !yearRaw ? new Date().getFullYear() : Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);
  const date = new Date(year, Number(match[2]) - 1, Number(match[1]));
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function leadStatus(value: string): Lead["status"] {
  const date = parseDate(value);
  if (!date) return "sem-data";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() < today.getTime()) return "atrasado";
  if (date.getTime() === today.getTime()) return "hoje";
  return "proximo";
}

type LeadActivity = {
  data: string;
  tipo: "CONTATO" | "CADASTRO" | "REATIVAÇÃO" | "IMPORTAÇÃO";
  cliente: string;
  proximoContato: string;
  observacoes: string;
};

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function ensureHistorySheet(sessionAccessToken?: string) {
  const sheets = await sheetsClient(sessionAccessToken);
  const meta = await sheets.spreadsheets.get({ spreadsheetId: LEADS_SPREADSHEET_ID, fields: "sheets.properties.title" });
  const exists = (meta.data.sheets ?? []).some((sheet) => sheet.properties?.title === LEADS_HISTORY_SHEET);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: LEADS_SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: LEADS_HISTORY_SHEET, hidden: true } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: LEADS_SPREADSHEET_ID,
      range: `'${LEADS_HISTORY_SHEET}'!A1:E1`,
      valueInputOption: "RAW",
      requestBody: { values: [["Data", "Tipo", "Empresa", "Próximo contato", "Observações"]] },
    });
  }
  return sheets;
}

async function logActivities(activities: LeadActivity[], sessionAccessToken?: string) {
  if (!activities.length) return;
  const sheets = await ensureHistorySheet(sessionAccessToken);
  await sheets.spreadsheets.values.append({
    spreadsheetId: LEADS_SPREADSHEET_ID,
    range: `'${LEADS_HISTORY_SHEET}'!A:E`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: activities.map((item) => [item.data, item.tipo, item.cliente, item.proximoContato, item.observacoes]) },
  });
}

export async function listLeadActivities(sessionAccessToken?: string): Promise<LeadActivity[]> {
  const sheets = await ensureHistorySheet(sessionAccessToken);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: LEADS_SPREADSHEET_ID,
    range: `'${LEADS_HISTORY_SHEET}'!A2:E5000`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  return (response.data.values ?? []).map((row) => ({
    data: String(row[0] ?? "").trim(),
    tipo: String(row[1] ?? "").trim() as LeadActivity["tipo"],
    cliente: String(row[2] ?? "").trim(),
    proximoContato: String(row[3] ?? "").trim(),
    observacoes: String(row[4] ?? "").trim(),
  })).filter((item) => item.data && item.cliente);
}

function inPeriod(value: string, start: Date, end: Date) {
  const date = parseDate(value);
  return Boolean(date && date.getTime() >= start.getTime() && date.getTime() <= end.getTime());
}

export async function createLeadsReport(input: { startDate: string; endDate: string }, sessionAccessToken?: string) {
  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  if (!start || !end || start.getTime() > end.getTime()) throw new Error("Informe um período válido para o relatório.");
  const maximum = new Date(start);
  maximum.setFullYear(maximum.getFullYear() + 1);
  if (end.getTime() > maximum.getTime()) throw new Error("O período máximo do relatório é de 1 ano.");
  end.setHours(23, 59, 59, 999);

  const [leads, activities] = await Promise.all([listLeads(sessionAccessToken), listLeadActivities(sessionAccessToken)]);
  const periodActivities = activities.filter((item) => inPeriod(item.data, start, end));
  const completedNames = new Set(periodActivities.filter((item) => item.tipo === "CONTATO").map((item) => item.cliente.toLocaleLowerCase("pt-BR")));
  leads.forEach((lead) => {
    if (inPeriod(lead.ultimoContato, start, end)) completedNames.add(lead.cliente.toLocaleLowerCase("pt-BR"));
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pending = leads.filter((lead) => {
    const date = parseDate(lead.proximoContato);
    return Boolean(date && date.getTime() >= today.getTime() && date.getTime() >= start.getTime() && date.getTime() <= end.getTime());
  });
  const overdue = leads.filter((lead) => {
    const date = parseDate(lead.proximoContato);
    return Boolean(date && date.getTime() < today.getTime() && date.getTime() <= end.getTime());
  });
  const completed = completedNames.size;
  const total = completed + pending.length + overdue.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const newLeads = periodActivities.filter((item) => item.tipo === "CADASTRO" || item.tipo === "IMPORTAÇÃO").length;
  const reactivated = periodActivities.filter((item) => item.tipo === "REATIVAÇÃO").length;
  const withoutDate = leads.filter((lead) => !parseDate(lead.proximoContato)).length;

  const weekly: Array<[string, number, number, number, number]> = [];
  const cursor = new Date(end);
  cursor.setHours(0, 0, 0, 0);
  const day = cursor.getDay();
  cursor.setDate(cursor.getDate() - (day === 0 ? 6 : day - 1));
  for (let index = 5; index >= 0; index -= 1) {
    const weekStart = new Date(cursor);
    weekStart.setDate(cursor.getDate() - (index * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const done = new Set<string>();
    activities.filter((item) => item.tipo === "CONTATO" && inPeriod(item.data, weekStart, weekEnd)).forEach((item) => done.add(item.cliente.toLocaleLowerCase("pt-BR")));
    leads.filter((lead) => inPeriod(lead.ultimoContato, weekStart, weekEnd)).forEach((lead) => done.add(lead.cliente.toLocaleLowerCase("pt-BR")));
    const scheduled = leads.filter((lead) => inPeriod(lead.proximoContato, weekStart, weekEnd));
    const late = scheduled.filter((lead) => (parseDate(lead.proximoContato)?.getTime() ?? 0) < today.getTime()).length;
    const open = Math.max(0, scheduled.length - late);
    const base = done.size + open + late;
    weekly.push([
      `${String(weekStart.getDate()).padStart(2, "0")}/${String(weekStart.getMonth() + 1).padStart(2, "0")} a ${String(weekEnd.getDate()).padStart(2, "0")}/${String(weekEnd.getMonth() + 1).padStart(2, "0")}`,
      done.size,
      open,
      late,
      base ? Math.round((done.size / base) * 100) : 0,
    ]);
  }

  const sheets = await sheetsClient(sessionAccessToken);
  const titleDate = formatIsoDate(new Date()).split("-").reverse().join("-");
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `Relatório Leads - ${titleDate}`, locale: "pt_BR", timeZone: "America/Sao_Paulo" },
      sheets: [{ properties: { title: "Resumo" } }, { properties: { title: "Detalhamento" } }],
    },
    fields: "spreadsheetId,spreadsheetUrl,sheets.properties",
  });
  const reportId = created.data.spreadsheetId;
  if (!reportId) throw new Error("Não foi possível criar a Google Planilha.");
  const periodLabel = `${formatIsoDate(start).split("-").reverse().join("/")} a ${formatIsoDate(end).split("-").reverse().join("/")}`;
  const detailed = leads.filter((lead) => completedNames.has(lead.cliente.toLocaleLowerCase("pt-BR")) || pending.includes(lead) || overdue.includes(lead));
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: reportId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: "'Resumo'!A1:E18",
          values: [
            ["RELATÓRIO DE AVANÇO — LEADS"],
            ["Período", periodLabel],
            ["Realizados", completed],
            ["Pendentes", pending.length],
            ["Atrasados", overdue.length],
            ["Avanço", progress / 100],
            ["Novos leads", newLeads],
            ["Reativados", reactivated],
            ["Sem próxima data", withoutDate],
            [],
            ["Evolução semanal"],
            ["Semana", "Realizados", "Pendentes", "Atrasados", "Avanço"],
            ...weekly.map(([label, done, open, late, percentage]) => [label, done, open, late, percentage / 100]),
          ],
        },
        {
          range: `'Detalhamento'!A1:H${Math.max(2, detailed.length + 1)}`,
          values: [
            ["Empresa", "Segmento", "Contato", "Telefone/E-mail", "Último contato", "Próximo contato", "Situação", "Observações"],
            ...detailed.map((lead) => [lead.cliente, lead.segmento, lead.contato, lead.canal, lead.ultimoContato, lead.proximoContato, completedNames.has(lead.cliente.toLocaleLowerCase("pt-BR")) ? "Realizado" : lead.status === "atrasado" ? "Atrasado" : "Pendente", lead.observacoes]),
          ],
        },
      ],
    },
  });
  const summarySheetId = created.data.sheets?.find((sheet) => sheet.properties?.title === "Resumo")?.properties?.sheetId;
  const detailSheetId = created.data.sheets?.find((sheet) => sheet.properties?.title === "Detalhamento")?.properties?.sheetId;
  const requests: sheets_v4.Schema$Request[] = [summarySheetId, detailSheetId].filter((value): value is number => typeof value === "number").flatMap((sheetId) => [
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: sheetId === detailSheetId ? 1 : 0 } }, fields: "gridProperties.frozenRowCount" } },
    { autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: sheetId === detailSheetId ? 8 : 5 } } },
  ]);
  if (summarySheetId !== undefined) {
    requests.push(
      { repeatCell: { range: { sheetId: summarySheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 5 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.08, green: 0.25, blue: 0.55 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 14 } } }, fields: "userEnteredFormat" } },
      { repeatCell: { range: { sheetId: summarySheetId, startRowIndex: 5, endRowIndex: 6, startColumnIndex: 1, endColumnIndex: 2 }, cell: { userEnteredFormat: { numberFormat: { type: "PERCENT", pattern: "0%" } } }, fields: "userEnteredFormat.numberFormat" } },
      { repeatCell: { range: { sheetId: summarySheetId, startRowIndex: 12, endRowIndex: 18, startColumnIndex: 4, endColumnIndex: 5 }, cell: { userEnteredFormat: { numberFormat: { type: "PERCENT", pattern: "0%" } } }, fields: "userEnteredFormat.numberFormat" } },
    );
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: reportId, requestBody: { requests } });
  return { url: created.data.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${reportId}/edit`, metrics: { completed, pending: pending.length, overdue: overdue.length, progress, newLeads, reactivated, withoutDate }, weekly };
}

async function ensureProspectsPortalSheet(sessionAccessToken?: string) {
  const sheets = await sheetsClient(sessionAccessToken);
  const meta = await sheets.spreadsheets.get({ spreadsheetId: LEADS_SPREADSHEET_ID, fields: "sheets.properties.title" });
  const exists = (meta.data.sheets ?? []).some((sheet) => sheet.properties?.title === PROSPECTS_PORTAL_SHEET);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: LEADS_SPREADSHEET_ID, requestBody: { requests: [{ addSheet: { properties: { title: PROSPECTS_PORTAL_SHEET } } }] } });
    await sheets.spreadsheets.values.update({
      spreadsheetId: LEADS_SPREADSHEET_ID,
      range: `'${PROSPECTS_PORTAL_SHEET}'!A1:G1`,
      valueInputOption: "RAW",
      requestBody: { values: [["Empresa", "Segmento", "Cidade/Região", "Contato", "Telefone/E-mail", "Produto/Oportunidade", "Observações"]] },
    });
  }
  return sheets;
}

export async function listLeads(sessionAccessToken?: string): Promise<Lead[]> {
  const sheets = await sheetsClient(sessionAccessToken);
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: LEADS_SPREADSHEET_ID, range: `'${LEADS_SHEET}'!A2:G1000`, valueRenderOption: "FORMATTED_VALUE" });
  return (response.data.values ?? []).map((r, index) => ({
    row: index + 2,
    cliente: String(r[0] ?? "").trim(), segmento: String(r[1] ?? "").trim(), contato: String(r[2] ?? "").trim(), canal: String(r[3] ?? "").trim(),
    ultimoContato: String(r[4] ?? "").trim(), proximoContato: String(r[5] ?? "").trim(), observacoes: String(r[6] ?? "").trim(), status: leadStatus(String(r[5] ?? "")),
  })).filter((lead) => lead.cliente).sort((a, b) => {
    const aDate = parseDate(a.proximoContato)?.getTime() ?? Number.POSITIVE_INFINITY;
    const bDate = parseDate(b.proximoContato)?.getTime() ?? Number.POSITIVE_INFINITY;
    return aDate - bDate || a.cliente.localeCompare(b.cliente, "pt-BR");
  });
}

export async function listProspects(sessionAccessToken?: string): Promise<Prospect[]> {
  const sheets = await ensureProspectsPortalSheet(sessionAccessToken);
  const [historico, portal] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: LEADS_SPREADSHEET_ID, range: `'${PROSPECTS_SOURCE_SHEET}'!A2:D1000`, valueRenderOption: "FORMATTED_VALUE" }),
    sheets.spreadsheets.values.get({ spreadsheetId: LEADS_SPREADSHEET_ID, range: `'${PROSPECTS_PORTAL_SHEET}'!A2:G1000`, valueRenderOption: "FORMATTED_VALUE" }),
  ]);
  const antigo: Prospect[] = (historico.data.values ?? []).map((r, i) => ({ id: `h-${i + 2}`, cliente: String(r[1] ?? "").trim(), segmento: "", cidade: "", contato: "", canal: "", oportunidade: "Reativação", observacoes: `Código ${String(r[0] ?? "").trim()} · Vendas ${String(r[2] ?? "").trim()} · Último faturamento ${String(r[3] ?? "").trim()}`, origem: "historico" as const })).filter((x) => x.cliente);
  const novos: Prospect[] = (portal.data.values ?? []).map((r, i) => ({ id: `p-${i + 2}`, cliente: String(r[0] ?? "").trim(), segmento: String(r[1] ?? "").trim(), cidade: String(r[2] ?? "").trim(), contato: String(r[3] ?? "").trim(), canal: String(r[4] ?? "").trim(), oportunidade: String(r[5] ?? "").trim(), observacoes: String(r[6] ?? "").trim(), origem: "portal" as const })).filter((x) => x.cliente);
  return [...novos, ...antigo];
}

async function assertNotDuplicate(cliente: string, sessionAccessToken?: string) {
  const target = cliente.trim().toLocaleLowerCase("pt-BR");
  const [leads, prospects] = await Promise.all([listLeads(sessionAccessToken), listProspects(sessionAccessToken)]);
  if (leads.some((x) => x.cliente.toLocaleLowerCase("pt-BR") === target) || prospects.some((x) => x.cliente.toLocaleLowerCase("pt-BR") === target)) throw new Error("Esta empresa já existe no Leads ou em A Prospectar.");
}

export async function addLead(input: { cliente:string; segmento:string; contato:string; canal:string; proximoContato:string; observacoes:string }, sessionAccessToken?: string) {
  if (!input.cliente.trim()) throw new Error("Informe a empresa.");
  if (!input.proximoContato.trim()) throw new Error("Informe a data do próximo contato.");
  await assertNotDuplicate(input.cliente, sessionAccessToken);
  const sheets = await sheetsClient(sessionAccessToken);
  await sheets.spreadsheets.values.append({ spreadsheetId: LEADS_SPREADSHEET_ID, range: `'${LEADS_SHEET}'!A:G`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [[input.cliente, input.segmento, input.contato, input.canal, "", input.proximoContato, input.observacoes]] } });
  await logActivities([{ data: formatIsoDate(new Date()), tipo: "CADASTRO", cliente: input.cliente, proximoContato: input.proximoContato, observacoes: input.observacoes }], sessionAccessToken);
}

export type LeadImportRow = {
  cliente: string;
  segmento?: string;
  contato?: string;
  canal?: string;
  ultimoContato?: string;
  proximoContato?: string;
  observacoes?: string;
};

export async function importLeads(rows: LeadImportRow[], sessionAccessToken?: string) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("O arquivo não possui registros para importar.");
  if (rows.length > 1000) throw new Error("Importe no máximo 1.000 registros por vez.");

  const [leads, prospects] = await Promise.all([listLeads(sessionAccessToken), listProspects(sessionAccessToken)]);
  const existing = new Set(
    [...leads, ...prospects].map((item) => item.cliente.trim().toLocaleLowerCase("pt-BR")),
  );
  const accepted: string[][] = [];
  const duplicates: string[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const cliente = String(row?.cliente ?? "").trim();
    if (!cliente) {
      errors.push(`Linha ${index + 2}: empresa não informada.`);
      return;
    }
    const key = cliente.toLocaleLowerCase("pt-BR");
    if (existing.has(key)) {
      duplicates.push(cliente);
      return;
    }
    existing.add(key);
    accepted.push([
      cliente,
      String(row.segmento ?? "").trim(),
      String(row.contato ?? "").trim(),
      String(row.canal ?? "").trim(),
      String(row.ultimoContato ?? "").trim(),
      String(row.proximoContato ?? "").trim(),
      String(row.observacoes ?? "").trim(),
    ]);
  });

  if (accepted.length) {
    const sheets = await sheetsClient(sessionAccessToken);
    await sheets.spreadsheets.values.append({
      spreadsheetId: LEADS_SPREADSHEET_ID,
      range: `'${LEADS_SHEET}'!A:G`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: accepted },
    });
    await logActivities(accepted.map((row) => ({ data: formatIsoDate(new Date()), tipo: "IMPORTAÇÃO" as const, cliente: row[0], proximoContato: row[5], observacoes: row[6] })), sessionAccessToken);
  }

  return { imported: accepted.length, duplicates, errors };
}

export async function addProspect(input: { cliente:string; segmento:string; cidade:string; contato:string; canal:string; oportunidade:string; observacoes:string }, sessionAccessToken?: string) {
  if (!input.cliente.trim()) throw new Error("Informe a empresa.");
  await assertNotDuplicate(input.cliente, sessionAccessToken);
  const sheets = await ensureProspectsPortalSheet(sessionAccessToken);
  await sheets.spreadsheets.values.append({ spreadsheetId: LEADS_SPREADSHEET_ID, range: `'${PROSPECTS_PORTAL_SHEET}'!A:G`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values: [[input.cliente, input.segmento, input.cidade, input.contato, input.canal, input.oportunidade, input.observacoes]] } });
  await logActivities([{ data: formatIsoDate(new Date()), tipo: "CADASTRO", cliente: input.cliente, proximoContato: "", observacoes: input.observacoes }], sessionAccessToken);
}

export async function reactivateProspect(input: { id:string; cliente:string; segmento:string; contato:string; canal:string; proximoContato:string; observacoes:string }, sessionAccessToken?: string) {
  const idMatch = input.id.match(/^([hp])-(\d+)$/);
  if (!idMatch) throw new Error("Registro de prospecção inválido.");
  const row = Number(idMatch[2]);
  if (!Number.isInteger(row) || row < 2 || row > 1000) throw new Error("Linha de prospecção inválida.");
  if (!input.cliente.trim()) throw new Error("Informe a empresa.");
  if (!input.proximoContato.trim()) throw new Error("Informe a data do próximo contato.");

  const [leads, prospects] = await Promise.all([listLeads(sessionAccessToken), listProspects(sessionAccessToken)]);
  const source = prospects.find((prospect) => prospect.id === input.id);
  if (!source) throw new Error("Esta empresa não está mais em A Prospectar.");
  const target = input.cliente.trim().toLocaleLowerCase("pt-BR");
  if (leads.some((lead) => lead.cliente.toLocaleLowerCase("pt-BR") === target) || prospects.some((prospect) => prospect.id !== input.id && prospect.cliente.toLocaleLowerCase("pt-BR") === target)) throw new Error("Esta empresa já existe no Follow-up ou em A Prospectar.");

  const sheets = await sheetsClient(sessionAccessToken);
  await sheets.spreadsheets.values.append({
    spreadsheetId: LEADS_SPREADSHEET_ID,
    range: `'${LEADS_SHEET}'!A:G`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[input.cliente, input.segmento, input.contato, input.canal, "", input.proximoContato, input.observacoes]] },
  });
  const sourceSheet = idMatch[1] === "h" ? PROSPECTS_SOURCE_SHEET : PROSPECTS_PORTAL_SHEET;
  const sourceColumns = idMatch[1] === "h" ? "A:D" : "A:G";
  await sheets.spreadsheets.values.clear({ spreadsheetId: LEADS_SPREADSHEET_ID, range: `'${sourceSheet}'!${sourceColumns.split(":")[0]}${row}:${sourceColumns.split(":")[1]}${row}` });
  await logActivities([{ data: formatIsoDate(new Date()), tipo: "REATIVAÇÃO", cliente: input.cliente, proximoContato: input.proximoContato, observacoes: input.observacoes }], sessionAccessToken);
}

export async function moveLeadToProspects(input: { row:number }, sessionAccessToken?: string) {
  if (!Number.isInteger(input.row) || input.row < 2 || input.row > 1000) throw new Error("Linha de Follow-up inválida.");
  const [leads, prospects] = await Promise.all([listLeads(sessionAccessToken), listProspects(sessionAccessToken)]);
  const source = leads.find((lead) => lead.row === input.row);
  if (!source) throw new Error("Esta empresa não está mais no Follow-up.");
  const target = source.cliente.trim().toLocaleLowerCase("pt-BR");
  if (prospects.some((prospect) => prospect.cliente.toLocaleLowerCase("pt-BR") === target)) throw new Error("Esta empresa já existe em A Prospectar.");

  const dateHistory = [source.ultimoContato ? `Último contato: ${source.ultimoContato}` : "", source.proximoContato ? `Próximo contato anterior: ${source.proximoContato}` : ""].filter(Boolean).join(" · ");
  const observations = [source.observacoes, dateHistory].filter(Boolean).join(" · ");
  const sheets = await ensureProspectsPortalSheet(sessionAccessToken);
  await sheets.spreadsheets.values.append({
    spreadsheetId: LEADS_SPREADSHEET_ID,
    range: `'${PROSPECTS_PORTAL_SHEET}'!A:G`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[source.cliente, source.segmento, "", source.contato, source.canal, "Transferido do Follow-up", observations]] },
  });
  await sheets.spreadsheets.values.clear({ spreadsheetId: LEADS_SPREADSHEET_ID, range: `'${LEADS_SHEET}'!A${input.row}:G${input.row}` });
}

export async function updateLeadFollowUp(input: { row: number; cliente: string; segmento: string; contato: string; canal: string; ultimoContato: string; proximoContato: string; observacoes: string }, sessionAccessToken?: string) {
  if (!Number.isInteger(input.row) || input.row < 2 || input.row > 1000) throw new Error("Linha inválida");
  if (!input.cliente.trim()) throw new Error("Informe a empresa.");
  if (!input.proximoContato.trim()) throw new Error("Informe a data do próximo contato.");
  const target = input.cliente.trim().toLocaleLowerCase("pt-BR");
  const [leads, prospects] = await Promise.all([listLeads(sessionAccessToken), listProspects(sessionAccessToken)]);
  if (leads.some((lead) => lead.row !== input.row && lead.cliente.toLocaleLowerCase("pt-BR") === target) || prospects.some((prospect) => prospect.cliente.toLocaleLowerCase("pt-BR") === target)) throw new Error("Esta empresa já existe no Leads ou em A Prospectar.");
  const sheets = await sheetsClient(sessionAccessToken);
  await sheets.spreadsheets.values.update({ spreadsheetId: LEADS_SPREADSHEET_ID, range: `'${LEADS_SHEET}'!A${input.row}:G${input.row}`, valueInputOption: "USER_ENTERED", requestBody: { values: [[input.cliente, input.segmento, input.contato, input.canal, input.ultimoContato, input.proximoContato, input.observacoes]] } });
  const contactDate = parseDate(input.ultimoContato) ? formatIsoDate(parseDate(input.ultimoContato)!) : formatIsoDate(new Date());
  await logActivities([{ data: contactDate, tipo: "CONTATO", cliente: input.cliente, proximoContato: input.proximoContato, observacoes: input.observacoes }], sessionAccessToken);
}
