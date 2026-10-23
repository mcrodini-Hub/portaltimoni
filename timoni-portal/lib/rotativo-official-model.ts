import { randomUUID } from "node:crypto";
import type { sheets_v4 } from "googleapis";

type Cell = sheets_v4.Schema$CellData;
type Request = sheets_v4.Schema$Request;
export const ROTATIVO_HEADERS = ["VENDA", "COMPRA", "DESCRIÇÃO", "ESTOQUE", "UN"];
export const ROTATIVO_MODEL_SPREADSHEET_ID = "1pKUVJYgJJ7ankF5wxgUoS__R8TsWzFhri4693husW5k";
const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const occupied = (c?: Cell) => Boolean(c?.userEnteredValue && Object.values(c.userEnteredValue).some(v => v !== "" && v != null));
const label = (c?: Cell) => c?.formattedValue ?? c?.userEnteredValue?.stringValue ?? "";
export function colLetter(i: number) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
}
export function gridRows(sheet: sheets_v4.Schema$Sheet): Cell[][] {
  const rows: Cell[][] = [];
  for (const block of sheet.data || []) (block.rowData || []).forEach((row, r) => {
    const target = rows[r + (block.startRow || 0)] ||= [];
    (row.values || []).forEach((c, i) => { target[i + (block.startColumn || 0)] = c; });
  });
  return rows;
}
const white = { red: 1, green: 1, blue: 1 }, black = { red: 0, green: 0, blue: 0 };
const red = { red: 0.83137256, green: 0.047058824, blue: 0.050980393 };
const blue = { red: 0.07450981, green: 0.011764706, blue: 0.5529412 };
const lightBlue = { red: 0.85882354, green: 0.9137255, blue: 0.96862745 };
const yellow = { red: 1, green: 0.9019608, blue: 0.6 };

// Pure planner. Native dimension moves retain typed values, formulas and number formats.
export function planOfficialRotativoModel(sheet: sheets_v4.Schema$Sheet, title: string, now = new Date(), model?: sheets_v4.Schema$Sheet) {
  const sheetId = sheet.properties?.sheetId;
  if (sheetId == null) throw new Error("A aba selecionada não foi encontrada.");
  const rows = gridRows(sheet);
  const aliases = [
    ["venda", "codigo", "cod venda", "codigo venda", "codigo de venda", "sku", "referencia"],
    ["compra", "cod compra", "codigo compra", "codigo de compra", "codigo fornecedor", "cod fornecedor"],
    ["descricao", "produto", "mercadoria", "nome produto"],
    ["estoque", "quantidade", "qtd", "saldo", "estoque atual"], ["un", "unidade", "und"],
  ];
  const candidates = rows.map((row, index) => {
    const names = row.map(c => norm(label(c)));
    const columns = aliases.map((allowed, column) => {
      const preferred = column === 0 && names.includes("venda") ? ["venda"] : allowed;
      const hits = names.map((n, i) => preferred.includes(n) ? i : -1).filter(i => i >= 0);
      return hits.length === 1 ? hits[0] : -1;
    });
    return { index, columns, names };
  }).filter(x => x.columns[0] >= 0 && x.columns[2] >= 0 && x.columns[3] >= 0);
  if (candidates.length !== 1) throw new Error("Cabeçalho desconhecido ou ambíguo. Nenhuma alteração foi feita.");
  const { index: headerIndex, columns, names } = candidates[0];
  const official = headerIndex === 6 && ROTATIVO_HEADERS.every((h, i) => names[i] === norm(h));
  if (headerIndex > 6) throw new Error("Cabeçalho abaixo da linha 7. Revise a estrutura antes de padronizar.");
  const rowShift = 6 - headerIndex;
  let lastSourceRow = headerIndex;
  // Auxiliary ITEM/min/max alone never define a product or extend the table.
  const isProduct = (row: Cell[]) => columns.some(c => c >= 0 && occupied(row[c]));
  rows.forEach((row, i) => { if (i > headerIndex && isProduct(row)) lastSourceRow = i; });
  if (lastSourceRow === headerIndex) throw new Error("Nenhum produto encontrado abaixo do cabeçalho.");
  const sourceWidth = Math.max(1, ...rows.slice(headerIndex).filter(Boolean).map(row => {
    let end = row.length;
    while (end && !occupied(row[end - 1])) end--;
    return end;
  }));
  const excluded = names.map((n, i) => ["item", "numero", "min", "minimo", "max", "maximo", "estoque minimo", "estoque maximo"].includes(n) ? i : -1).filter(i => i >= 0 && !columns.includes(i));
  const histories = Array.from({ length: sourceWidth }, (_, i) => i).filter(i => !columns.includes(i) && !excluded.includes(i));
  const lastRow = lastSourceRow + rowShift + 1, lastColumn = 5 + histories.length;
  for (const c of columns.slice(0, 2).filter(c => c >= 0)) for (let r = headerIndex + 1; r <= lastSourceRow; r++) {
    const cell = rows[r]?.[c], n = cell?.userEnteredValue?.numberValue;
    if (n != null && cell?.formattedValue != null && cell.formattedValue !== String(n)) throw new Error(`Código com formato especial em ${colLetter(c)}${r + 1}. A conversão para texto alteraria sua exibição.`);
  }
  // Literal arithmetic has no references for column deletion to invalidate.
  // Keep rejecting reference-bearing/unknown formulas before any write.
  if (excluded.length && rows.slice(headerIndex + 1).some(row => row.some(c => {
    const formula = c.userEnteredValue?.formulaValue;
    return formula && !/^=[\d\s.+\-*/%^()]+$/.test(formula);
  }))) throw new Error("Planilha com fórmulas e colunas auxiliares antigas: revise as referências antes da migração.");
  const requests: Request[] = [];
  for (let i = (sheet.conditionalFormats || []).length - 1; i >= 0; i--) requests.push({ deleteConditionalFormatRule: { sheetId, index: i } });
  for (const m of sheet.merges || []) requests.push({ unmergeCells: { range: m } });
  if (sheet.basicFilter) requests.push({ clearBasicFilter: { sheetId } });
  for (const f of sheet.filterViews || []) if (f.filterViewId != null) requests.push({ deleteFilterView: { filterId: f.filterViewId } });
  for (const b of sheet.bandedRanges || []) if (b.bandedRangeId != null) requests.push({ deleteBanding: { bandedRangeId: b.bandedRangeId } });
  if ((sheet as sheets_v4.Schema$Sheet & { tables?: unknown[] }).tables?.length) throw new Error("A aba contém tabela nativa. Revise a estrutura antes de padronizar.");
  if (rowShift) requests.push({ insertDimension: { range: { sheetId, dimension: "ROWS", startIndex: headerIndex, endIndex: 6 }, inheritFromBefore: false } });
  const order = Array.from({ length: sheet.properties?.gridProperties?.columnCount || sourceWidth }, (_, i) => i);
  for (let dest = 0; dest < 5; dest++) {
    const original = columns[dest];
    if (original < 0) {
      requests.push({ insertDimension: { range: { sheetId, dimension: "COLUMNS", startIndex: dest, endIndex: dest + 1 }, inheritFromBefore: false } });
      order.splice(dest, 0, -dest - 1);
    } else {
      const from = order.indexOf(original);
      if (from !== dest) {
        requests.push({ moveDimension: { source: { sheetId, dimension: "COLUMNS", startIndex: from, endIndex: from + 1 }, destinationIndex: dest } });
        order.splice(dest, 0, order.splice(from, 1)[0]);
      }
    }
  }
  for (const i of excluded.map(i => order.indexOf(i)).sort((a, b) => b - a)) {
    requests.push({ deleteDimension: { range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 } } });
    order.splice(i, 1);
  }
  const rowCount = (sheet.properties?.gridProperties?.rowCount || rows.length) + rowShift, columnCount = order.length;
  const range = (r: number, end: number, c: number, ce: number) => ({ sheetId, startRowIndex: r, endRowIndex: end, startColumnIndex: c, endColumnIndex: ce });
  const fmt = (r: number, end: number, c: number, ce: number, userEnteredFormat: sheets_v4.Schema$CellFormat, fields: string) => {
    if (end > r && ce > c) requests.push({ repeatCell: { range: range(r, end, c, ce), cell: { userEnteredFormat }, fields } });
  };
  // Clear visual inheritance, never numberFormat. Blank surroundings lose old borders/alignment.
  fmt(0, rowCount, 0, columnCount, {}, "userEnteredFormat(backgroundColor,backgroundColorStyle,borders,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy,textDirection,padding,textRotation)");
  // Outside the used rectangle there are no product/history values to format.
  // Remove even inherited number formats from these blank surroundings.
  fmt(lastRow, rowCount, 0, columnCount, {}, "userEnteredFormat");
  fmt(0, lastRow, lastColumn, columnCount, {}, "userEnteredFormat");
  requests.push({ repeatCell: { range: range(0, rowCount, 0, columnCount), cell: {}, fields: "dataValidation" } });
  fmt(0, lastRow, 0, lastColumn, { backgroundColor: white, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: false, foregroundColor: black }, wrapStrategy: "OVERFLOW_CELL" }, "userEnteredFormat(backgroundColor,textFormat,wrapStrategy)");
  fmt(0, 6, 0, lastColumn, { horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE" }, "userEnteredFormat(horizontalAlignment,verticalAlignment)");
  fmt(0, 1, 0, 1, { textFormat: { fontFamily: "Calibri", fontSize: 16, bold: true, foregroundColor: black } }, "userEnteredFormat.textFormat");
  fmt(1, 2, 0, 2, { backgroundColor: lightBlue, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: black } }, "userEnteredFormat(backgroundColor,textFormat)");
  fmt(2, 3, 0, 2, { backgroundColor: yellow }, "userEnteredFormat.backgroundColor");
  fmt(2, 3, 0, 1, { textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: black } }, "userEnteredFormat.textFormat");
  fmt(3, 5, 0, 1, { textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: red } }, "userEnteredFormat.textFormat");
  fmt(5, 6, 5, lastColumn, { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" }, "userEnteredFormat(horizontalAlignment,verticalAlignment)");
  fmt(6, lastRow, 0, lastColumn, { horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" }, "userEnteredFormat(horizontalAlignment,verticalAlignment)");
  fmt(7, lastRow, 2, 3, { horizontalAlignment: "LEFT" }, "userEnteredFormat.horizontalAlignment");
  fmt(6, 7, 0, lastColumn, { backgroundColor: blue, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: white } }, "userEnteredFormat(backgroundColor,textFormat)");
  if (model) {
    const reference = gridRows(model);
    if (!ROTATIVO_HEADERS.every((h, i) => label(reference[6]?.[i]) === h)) throw new Error("A aba MODELO não contém o cabeçalho oficial na linha 7.");
    // Read only the visual style. Never copy template values, date/number formats,
    // borders outside the table, or its five placeholder history names.
    const visual = (r: number, c: number): sheets_v4.Schema$CellFormat => {
      const f = reference[r]?.[c]?.effectiveFormat || reference[r]?.[c]?.userEnteredFormat;
      if (!f?.textFormat?.fontFamily) throw new Error("Formatação incompleta na aba MODELO.");
      return { backgroundColor: f.backgroundColor || white, textFormat: { ...f.textFormat, foregroundColor: f.textFormat.foregroundColor || black }, wrapStrategy: f.wrapStrategy || "OVERFLOW_CELL" };
    };
    const mask = "userEnteredFormat(backgroundColor,textFormat,wrapStrategy)";
    for (let r = 0; r < 5; r++) for (let c = 0; c < (r === 1 || r === 2 ? 2 : 1); c++) fmt(r, r + 1, c, c + 1, visual(r, c), mask);
    for (let c = 0; c < 6; c++) {
      const to = c === 5 ? lastColumn : c + 1;
      fmt(6, 7, c, to, visual(6, c), mask);
      fmt(7, lastRow, c, to, visual(7, c), mask);
    }
    fmt(5, 6, 5, lastColumn, visual(5, 5), mask);
  }
  fmt(7, lastRow, 0, 2, { numberFormat: { type: "TEXT", pattern: "@" } }, "userEnteredFormat.numberFormat");
  for (let r = headerIndex + 1; r <= lastSourceRow; r++) {
    const nf = rows[r]?.[columns[3]]?.userEnteredFormat?.numberFormat;
    if (!nf || nf.type !== "NUMBER" || nf.pattern === "0.###############") {
      const value = rows[r]?.[columns[3]]?.effectiveValue?.numberValue ?? rows[r]?.[columns[3]]?.userEnteredValue?.numberValue;
      const [mantissa, exponent = "0"] = String(value ?? 0).split("e");
      const decimals = Math.min(15, Math.max(0, (mantissa.split(".")[1]?.length || 0) - Number(exponent)));
      const pattern = decimals ? `0.${"0".repeat(decimals)}` : "0";
      fmt(r + rowShift, r + rowShift + 1, 3, 4, { numberFormat: { type: "NUMBER", pattern } }, "userEnteredFormat.numberFormat");
    }
  }
  const border = { style: "SOLID", color: black };
  requests.push({ updateBorders: { range: range(6, lastRow, 0, lastColumn), top: border, bottom: border, left: border, right: border, innerHorizontal: border, innerVertical: border } });
  const write = (r: number, c: number, value: sheets_v4.Schema$ExtendedValue) => requests.push({ updateCells: { start: { sheetId, rowIndex: r, columnIndex: c }, rows: [{ values: [{ userEnteredValue: value }] }], fields: "userEnteredValue" } });
  const top = rows.slice(0, headerIndex).flat();
  const standardized = top.find(c => /^Padronizada em /i.test(label(c)));
  const updated = top.find(c => /^(?:Estoque\s+)?Rotativo atualizado em /i.test(label(c)));
  let responsible: Cell | undefined = official ? rows[3]?.[0] : undefined;
  let date: Cell | undefined = official ? rows[4]?.[0] : undefined;
  if (!official) for (const row of rows.slice(0, headerIndex)) {
    const emp = row.findIndex(c => norm(label(c)).includes("funcionario"));
    const dt = row.findIndex(c => norm(label(c)) === "data");
    if (emp >= 0) responsible = row.slice(emp + 1, dt > emp ? dt : undefined).find(occupied) || responsible;
    if (dt >= 0) date = row.slice(dt + 1).find(occupied) || date;
  }
  responsible ||= top.find(c => /^(lucas|jonatan|jonathan)$/i.test(String(label(c)).trim()));
  date ||= top.find(c => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(String(label(c)).trim()));
  const stamp = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(now);
  requests.push({ repeatCell: { range: range(0, 6, 0, columnCount), cell: {}, fields: "userEnteredValue" } });
  write(0, 0, { stringValue: official ? String(label(rows[0]?.[0])) : title.trim().toLocaleUpperCase("pt-BR") });
  write(1, 0, standardized?.userEnteredValue || { stringValue: `Padronizada em ${stamp}` });
  write(2, 0, updated?.userEnteredValue || { stringValue: "" });
  write(3, 0, responsible?.userEnteredValue || { stringValue: "" });
  write(4, 0, date?.userEnteredValue || { stringValue: "" });
  if (date?.userEnteredFormat?.numberFormat) fmt(4, 5, 0, 1, { numberFormat: date.userEnteredFormat.numberFormat }, "userEnteredFormat.numberFormat");
  for (let c = 0; c < 5; c++) write(6, c, { stringValue: ROTATIVO_HEADERS[c] });
  for (let c = 5; c < lastColumn; c++) write(5, c, { formulaValue: `=COUNTA(${colLetter(c)}8:${colLetter(c)})` });
  requests.push({ updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 7, frozenColumnCount: 0 } }, fields: "gridProperties(frozenRowCount,frozenColumnCount)" } });
  const dim = (dimension: string, a: number, b: number, pixelSize: number) => {
    if (b > a) requests.push({ updateDimensionProperties: { range: { sheetId, dimension, startIndex: a, endIndex: b }, properties: { pixelSize }, fields: "pixelSize" } });
  };
  [160, 160, 439, 103, 31].forEach((px, i) => dim("COLUMNS", i, i + 1, px));
  dim("COLUMNS", 5, lastColumn, 127);
  dim("ROWS", 0, 1, 32); dim("ROWS", 1, 5, 25); dim("ROWS", 5, 6, 19); dim("ROWS", 6, 7, 29); dim("ROWS", 7, lastRow, 19);
  if (model) for (const block of model.data || []) {
    (block.columnMetadata || []).forEach((m, i) => { const c = i + (block.startColumn || 0); if (c < 6 && m.pixelSize) dim("COLUMNS", c, c === 5 ? lastColumn : c + 1, m.pixelSize); });
    (block.rowMetadata || []).forEach((m, i) => { const r = i + (block.startRow || 0); if (r < 8 && m.pixelSize) dim("ROWS", r, r === 7 ? lastRow : r + 1, m.pixelSize); });
  }
  if (Buffer.byteLength(JSON.stringify(requests)) > 1_800_000) throw new Error("Planilha excede o tamanho seguro de uma operação. Nenhuma alteração foi feita.");
  return { requests, lastRow, lastColumn, headerIndex, rowShift, columns, histories, official, products: rows.slice(headerIndex + 1, lastSourceRow + 1).filter(isProduct).length };
}

export async function readRotativoSheet(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetName: string) {
  const q = `'${sheetName.replace(/'/g, "''")}'`;
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties(title),sheets(properties)" });
  const properties = meta.data.sheets?.find(s => s.properties?.title === sheetName)?.properties;
  if (!properties) throw new Error("A aba selecionada não foi encontrada.");
  const rowCount = properties.gridProperties?.rowCount || 0, columnCount = properties.gridProperties?.columnCount || 0;
  if (!rowCount || !columnCount || rowCount * columnCount > 200_000) throw new Error("A aba excede o limite seguro de leitura desta rotina.");
  const values = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${q}!A1:${colLetter(columnCount - 1)}${rowCount}`, valueRenderOption: "FORMULA" });
  const usedRows = Math.max(1, values.data.values?.length || 0);
  const usedColumns = Math.max(5, ...(values.data.values || []).map(row => row.length));
  const result = await sheets.spreadsheets.get({ spreadsheetId, ranges: [`${q}!A1:${colLetter(usedColumns - 1)}${usedRows}`], fields: "properties(title),sheets(properties,merges,conditionalFormats,basicFilter,filterViews,bandedRanges,tables,data(startRow,startColumn,rowData(values(userEnteredValue,effectiveValue,formattedValue,userEnteredFormat,dataValidation))))" });
  const sheet = result.data.sheets?.find(s => s.properties?.sheetId === properties.sheetId);
  if (!sheet) throw new Error("Não foi possível ler a aba selecionada.");
  return { sheet, title: result.data.properties?.title || sheetName };
}

export async function applyOfficialRotativoModel(sheets: sheets_v4.Sheets, spreadsheetId: string, sheetName: string) {
  if (spreadsheetId === ROTATIVO_MODEL_SPREADSHEET_ID) throw new Error("A planilha MODELO é somente referência e não pode ser padronizada.");
  const [snapshot, reference] = await Promise.all([
    readRotativoSheet(sheets, spreadsheetId, sheetName),
    sheets.spreadsheets.get({ spreadsheetId: ROTATIVO_MODEL_SPREADSHEET_ID, ranges: ["'MODELO'!A1:F8"], fields: "sheets(properties,data(startRow,startColumn,rowMetadata(pixelSize),columnMetadata(pixelSize),rowData(values(userEnteredValue,formattedValue,userEnteredFormat,effectiveFormat))))" }),
  ]);
  const model = reference.data.sheets?.find(s => s.properties?.title === "MODELO");
  if (!model) throw new Error("Não foi possível ler a aba MODELO. Nenhuma padronização foi executada.");
  const plan = planOfficialRotativoModel(snapshot.sheet, snapshot.title, new Date(), model);
  const sheetId = snapshot.sheet.properties!.sheetId!;
  const operationId = randomUUID(), backupName = `BKP_EXEC_${operationId.slice(0, 8)}_${sheetName}`.slice(0, 100);
  const backups = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ duplicateSheet: { sourceSheetId: sheetId, newSheetName: backupName } }] } });
  const backupId = backups.data.replies?.[0]?.duplicateSheet?.properties?.sheetId;
  if (backupId == null) throw new Error("Backup não confirmado. A padronização foi interrompida.");
  const requests: Request[] = [...plan.requests,
    { updateSheetProperties: { properties: { sheetId: backupId, hidden: true }, fields: "hidden" } },
    { createDeveloperMetadata: { developerMetadata: { metadataKey: "rotativo_operation", metadataValue: operationId, location: { sheetId }, visibility: "DOCUMENT" } } },
  ];
  try {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } }, { retry: false });
  } catch (cause) {
    const status = (cause as { response?: { status?: number } }).response?.status;
    if (status && [400, 401, 403, 404].includes(status)) throw new Error(`Padronização recusada pela API; nenhuma alteração aplicada. Backup: ${backupName}. ${cause instanceof Error ? cause.message : ""}`);
    const check = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets(properties(sheetId),developerMetadata)" }).catch(() => null);
    const applied = check?.data.sheets?.find(s => s.properties?.sheetId === sheetId)?.developerMetadata?.some(m => m.metadataKey === "rotativo_operation" && m.metadataValue === operationId);
    if (!applied) {
      const error = new Error(`Não foi possível confirmar a execução. Não repita agora; confira a planilha e o backup ${backupName}.`);
      error.name = "RotativoUncertainWriteError";
      throw error;
    }
  }
  const verified = await readRotativoSheet(sheets, spreadsheetId, sheetName), rows = gridRows(verified.sheet);
  if (!ROTATIVO_HEADERS.every((h, i) => label(rows[6]?.[i]) === h)) throw new Error("Cabeçalho não confirmado após a padronização. Preserve o backup.");
  for (let c = 5; c < plan.lastColumn; c++) if (rows[5]?.[c]?.effectiveValue?.errorValue || rows[5]?.[c]?.effectiveValue?.numberValue == null) throw new Error(`Contador ${colLetter(c)}6 não calculado. Preserve o backup.`);
  const before = gridRows(snapshot.sheet);
  const mapping = [...plan.columns, ...plan.histories];
  for (let r = plan.headerIndex; r < before.length; r++) for (let c = 0; c < mapping.length; c++) {
    if ((r === plan.headerIndex && c < 5) || mapping[c] < 0) continue;
    const source = before[r]?.[mapping[c]] || {}, target = rows[r + plan.rowShift]?.[c] || {};
    const a = source.userEnteredValue || {}, b = target.userEnteredValue || {};
    const structural = plan.rowShift !== 0 || mapping.some((v, i) => v !== i);
    const formulaMoved = Boolean(a.formulaValue && structural);
    if (formulaMoved ? (!b.formulaValue || JSON.stringify(source.effectiveValue) !== JSON.stringify(target.effectiveValue)) : JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error(`Dados divergentes em ${colLetter(c)}${r + plan.rowShift + 1}. Preserve o backup e não confirme.`);
    }
    if (c >= 5 && JSON.stringify(source.userEnteredFormat?.numberFormat || {}) !== JSON.stringify(target.userEnteredFormat?.numberFormat || {})) throw new Error("Formato do histórico divergente. Preserve o backup.");
    if (!formulaMoved && (source.formattedValue || "") !== (target.formattedValue || "")) throw new Error(`Exibição divergente em ${colLetter(c)}${r + plan.rowShift + 1}. Preserve o backup.`);
  }
  return { products: plan.products, backupUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${backupId}`, operationId };
}

