import type { sheets_v4 } from "googleapis";

function norm(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}

function colLetter(index: number) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export async function applyOfficialRotativoModel(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,gridProperties)",
  });
  const sheet = meta.data.sheets?.find((item) => item.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) throw new Error("A aba selecionada não foi encontrada.");
  const rowCount = Math.max(1000, sheet?.properties?.gridProperties?.rowCount || 1000);
  let columnCount = Math.max(10, sheet?.properties?.gridProperties?.columnCount || 26);
  const q = `'${sheetName.replace(/'/g, "''")}'`;

  let read = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${q}!A1:Z30`, valueRenderOption: "FORMULA" });
  let v = read.data.values || [];
  const employee = v[3]?.[2] ?? "";
  const originalDate = v[3]?.[3] ?? "";

  if (norm(v[6]?.[0]) !== "venda") {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ insertDimension: { range: { sheetId, dimension: "ROWS", startIndex: 4, endIndex: 6 }, inheritFromBefore: false } }] },
    });
  }

  read = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${q}!A1:Z30`, valueRenderOption: "FORMULA" });
  v = read.data.values || [];
  if (!["un", "und", "unidade"].includes(norm(v[6]?.[4]))) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ insertDimension: { range: { sheetId, dimension: "COLUMNS", startIndex: 4, endIndex: 5 }, inheritFromBefore: false } }] },
    });
    columnCount += 1;
  }

  const data: Array<{ range: string; values: unknown[][] }> = [
    { range: `${q}!A4`, values: [[employee]] },
    { range: `${q}!A5`, values: [[originalDate]] },
    { range: `${q}!C4`, values: [[""]] },
    { range: `${q}!D4`, values: [[""]] },
    { range: `${q}!E7`, values: [["UN"]] },
  ];
  for (let c = 5; c < columnCount; c += 1) {
    const letter = colLetter(c);
    data.push({ range: `${q}!${letter}6`, values: [[`=COUNTA(${letter}8:${letter}${rowCount})`]] });
  }
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data } });

  const requests: sheets_v4.Schema$Request[] = [
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { wrapStrategy: "OVERFLOW_CELL", textFormat: { fontFamily: "Calibri", fontSize: 16, bold: true }, verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(wrapStrategy,textFormat,verticalAlignment)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.859, green: 0.914, blue: 0.969 }, textFormat: { fontFamily: "Calibri", fontSize: 10 }, verticalAlignment: "MIDDLE", wrapStrategy: "OVERFLOW_CELL" } }, fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.902, blue: 0.6 }, textFormat: { fontFamily: "Calibri", fontSize: 10 }, verticalAlignment: "MIDDLE", wrapStrategy: "OVERFLOW_CELL" } }, fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 3, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: { red: 0.831, green: 0.047, blue: 0.051 } }, verticalAlignment: "MIDDLE", wrapStrategy: "OVERFLOW_CELL" } }, fields: "userEnteredFormat(textFormat,verticalAlignment,wrapStrategy)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" } } }, fields: "userEnteredFormat.numberFormat" } },
    { repeatCell: { range: { sheetId, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: columnCount }, cell: { userEnteredFormat: { backgroundColor: { red: 0.075, green: 0.012, blue: 0.553 }, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 7, endRowIndex: rowCount, startColumnIndex: 5, endColumnIndex: columnCount }, cell: { userEnteredFormat: { numberFormat: { type: "TEXT", pattern: "@" } } }, fields: "userEnteredFormat.numberFormat" } },
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 7 } }, fields: "gridProperties.frozenRowCount" } },
  ];

  const col = (a: number, b: number, px: number): sheets_v4.Schema$Request => ({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: a, endIndex: b }, properties: { pixelSize: px }, fields: "pixelSize" } });
  const row = (a: number, b: number, px: number): sheets_v4.Schema$Request => ({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: a, endIndex: b }, properties: { pixelSize: px }, fields: "pixelSize" } });
  requests.push(col(0,1,160), col(1,2,160), col(2,3,439), col(3,4,103), col(4,5,31), col(5,columnCount,127));
  requests.push(row(0,1,32), row(1,5,25), row(5,6,19), row(6,7,29), row(7,rowCount,19));
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}
