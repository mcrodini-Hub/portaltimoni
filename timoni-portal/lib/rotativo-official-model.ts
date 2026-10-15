import type { sheets_v4 } from "googleapis";

function norm(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function isDateLike(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(text) || /^\d{4}-\d{2}-\d{2}/.test(text);
}

const white = { red: 1, green: 1, blue: 1 };
const black = { red: 0, green: 0, blue: 0 };
const red = { red: 0.83137256, green: 0.047058824, blue: 0.050980393 };
const blue = { red: 0.07450981, green: 0.011764706, blue: 0.5529412 };
const lightBlue = { red: 0.85882354, green: 0.9137255, blue: 0.96862745 };
const yellow = { red: 1, green: 0.9019608, blue: 0.6 };
const solidBorders = {
  top: { style: "SOLID" },
  bottom: { style: "SOLID" },
  left: { style: "SOLID" },
  right: { style: "SOLID" },
};

export async function applyOfficialRotativoModel(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "properties(title),sheets(properties(sheetId,title,gridProperties),conditionalFormats)",
  });
  const sheet = meta.data.sheets?.find((item) => item.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) throw new Error("A aba selecionada não foi encontrada.");

  const rowCount = Math.max(1000, sheet?.properties?.gridProperties?.rowCount || 1000);
  const columnCount = Math.max(10, sheet?.properties?.gridProperties?.columnCount || 10);
  const q = `'${sheetName.replace(/'/g, "''")}'`;

  let read = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${q}!A1:${colLetter(Math.min(columnCount, 31) - 1)}40`,
    valueRenderOption: "FORMATTED_VALUE",
  });
  let values = read.data.values || [];

  const headerIndex = values.findIndex((row) => {
    const n = (row || []).map(norm);
    return n.includes("estoque") && (n.includes("codigo") || n.includes("venda") || n.includes("cod venda"));
  });
  if (headerIndex < 0) throw new Error("Não foi possível identificar o cabeçalho da planilha original.");

  const originalHeader = values[headerIndex] || [];
  const normalizedHeader = originalHeader.map(norm);
  const originalWasOfficial = normalizedHeader[0] === "venda";

  let employee = "";
  let originalDate: unknown = "";
  const topRows = values.slice(0, headerIndex);
  for (const row of topRows) {
    const normalized = (row || []).map(norm);
    const employeeLabel = normalized.findIndex((cell) => cell.includes("funcionario"));
    if (employeeLabel >= 0) {
      const dateLabel = normalized.findIndex((cell, index) => index > employeeLabel && cell === "data");
      const candidates = (row || [])
        .slice(employeeLabel + 1, dateLabel >= 0 ? dateLabel : undefined)
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);
      if (candidates.length) employee = candidates.join(" / ");
      if (dateLabel >= 0) {
        originalDate = (row || []).slice(dateLabel + 1).find((value) => String(value ?? "").trim() !== "") ?? "";
      }
    }
  }
  if (!employee) {
    employee = topRows
      .flat()
      .map((value) => String(value ?? "").trim())
      .find((value) => /(^|[\s/,;-])(lucas|luca|jonathan|jonatan)([\s/,;-]|$)/i.test(value)) || "";
  }
  if (!originalDate) originalDate = topRows.flat().find(isDateLike) ?? "";

  if (originalWasOfficial && headerIndex === 6) {
    employee = String(values[3]?.[0] ?? employee).trim();
    originalDate = values[4]?.[0] ?? originalDate;
  }

  const previousRotativoUpdate = topRows
    .flat()
    .map((value) => String(value ?? "").trim())
    .find((value) => /(?:estoque\s+)?rotativo\s+atualizado\s+em/i.test(value)) || "";
  const normalizedUpdate = previousRotativoUpdate
    ? previousRotativoUpdate.replace(/^Estoque\s+Rotativo atualizado em/i, "Rotativo atualizado em")
    : "";

  if (headerIndex < 6) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          insertDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: headerIndex, endIndex: 6 },
            inheritFromBefore: false,
          },
        }],
      },
    });
  }

  read = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${q}!A1:${colLetter(columnCount - 1)}${rowCount}`,
    valueRenderOption: "FORMULA",
  });
  values = read.data.values || [];
  const header = values[6] || [];

  if (!originalWasOfficial) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          cutPaste: {
            source: { sheetId, startRowIndex: 7, endRowIndex: rowCount, startColumnIndex: 1, endColumnIndex: 2 },
            destination: { sheetId, rowIndex: 7, columnIndex: 0 },
            pasteType: "PASTE_NORMAL",
          },
        }],
      },
    });
  }

  await sheets.spreadsheets.values.batchClear({
    spreadsheetId,
    requestBody: {
      ranges: [
        `${q}!B1:${colLetter(columnCount - 1)}5`,
        `${q}!A6:${colLetter(columnCount - 1)}6`,
      ],
    },
  });

  const supplierName = String(meta.data.properties?.title || sheetName).trim().toLocaleUpperCase("pt-BR");
  const standardizedAt = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  const historyColumns = header
    .map((value, index) => ({ value, index }))
    .filter(({ value, index }) => index >= 5 && String(value ?? "").trim() !== "")
    .map(({ index }) => index);
  const lastActiveColumn = Math.max(5, historyColumns.length ? Math.max(...historyColumns) + 1 : 5);

  const data: Array<{ range: string; values: unknown[][] }> = [
    { range: `${q}!A1`, values: [[supplierName]] },
    { range: `${q}!A2`, values: [[`Padronizada em ${standardizedAt}`]] },
    { range: `${q}!A3`, values: [[normalizedUpdate]] },
    { range: `${q}!A4`, values: [[employee]] },
    { range: `${q}!A5`, values: [[originalDate]] },
    { range: `${q}!A7:E7`, values: [["VENDA", "COMPRA", "DESCRIÇÃO", "ESTOQUE", "UN"]] },
  ];
  for (const c of historyColumns) {
    const letter = colLetter(c);
    data.push({ range: `${q}!${letter}6`, values: [[`=COUNTA(${letter}8:${letter}${rowCount})`]] });
  }
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });

  const requests: sheets_v4.Schema$Request[] = [];

  // Remova todas as regras condicionais antigas da aba. Elas não fazem parte do modelo oficial.
  const conditionalRules = sheet?.conditionalFormats || [];
  for (let i = conditionalRules.length - 1; i >= 0; i -= 1) {
    requests.push({ deleteConditionalFormatRule: { sheetId, index: i } });
  }

  // Limpe integralmente a formatação herdada sem tocar em valores, fórmulas ou históricos.
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: columnCount },
      cell: { userEnteredFormat: {} },
      fields: "userEnteredFormat",
    },
  });

  // Base do modelo: Calibri 11, branco, sem bordas, dados preservados.
  requests.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: lastActiveColumn },
      cell: { userEnteredFormat: { backgroundColor: white, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: false, foregroundColor: black }, verticalAlignment: "MIDDLE", wrapStrategy: "OVERFLOW_CELL" } },
      fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)",
    },
  });

  requests.push(
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: white, borders: solidBorders, textFormat: { fontFamily: "Calibri", fontSize: 16, bold: true, foregroundColor: black }, horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(backgroundColor,borders,textFormat,horizontalAlignment,verticalAlignment)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 2 }, cell: { userEnteredFormat: { backgroundColor: lightBlue, borders: solidBorders, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: black }, horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(backgroundColor,borders,textFormat,horizontalAlignment,verticalAlignment)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 2 }, cell: { userEnteredFormat: { backgroundColor: yellow, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: false, foregroundColor: black }, horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { borders: solidBorders, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: black } } }, fields: "userEnteredFormat(borders,textFormat)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 3, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: white, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: red }, horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" } } }, fields: "userEnteredFormat.numberFormat" } },
    { repeatCell: { range: { sheetId, startRowIndex: 5, endRowIndex: 6, startColumnIndex: 5, endColumnIndex: lastActiveColumn }, cell: { userEnteredFormat: { backgroundColor: white, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: false, foregroundColor: black } } }, fields: "userEnteredFormat(backgroundColor,textFormat)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: lastActiveColumn }, cell: { userEnteredFormat: { backgroundColor: blue, borders: solidBorders, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: white }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(backgroundColor,borders,textFormat,horizontalAlignment,verticalAlignment)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 7, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: 2 }, cell: { userEnteredFormat: { textFormat: { fontFamily: "Calibri", fontSize: 11, bold: false, foregroundColor: black }, verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(textFormat,verticalAlignment)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 7, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: 2 }, cell: { userEnteredFormat: { numberFormat: { type: "TEXT", pattern: "@" } } }, fields: "userEnteredFormat.numberFormat" } },
    { repeatCell: { range: { sheetId, startRowIndex: 7, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: 2 }, cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } }, fields: "userEnteredFormat.horizontalAlignment" } },
    { repeatCell: { range: { sheetId, startRowIndex: 7, endRowIndex: rowCount, startColumnIndex: 2, endColumnIndex: 3 }, cell: { userEnteredFormat: { horizontalAlignment: "LEFT" } }, fields: "userEnteredFormat.horizontalAlignment" } },
    { repeatCell: { range: { sheetId, startRowIndex: 7, endRowIndex: rowCount, startColumnIndex: 3, endColumnIndex: 5 }, cell: { userEnteredFormat: { textFormat: { fontFamily: "Calibri", fontSize: 11, bold: false, foregroundColor: black }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 7, endRowIndex: rowCount, startColumnIndex: 5, endColumnIndex: lastActiveColumn }, cell: { userEnteredFormat: { numberFormat: { type: "TEXT", pattern: "@" }, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: false, foregroundColor: black }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(numberFormat,textFormat,horizontalAlignment,verticalAlignment)" } },
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 7 } }, fields: "gridProperties.frozenRowCount" } },
  );

  const col = (a: number, b: number, px: number): sheets_v4.Schema$Request => ({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: a, endIndex: b }, properties: { pixelSize: px }, fields: "pixelSize" } });
  const row = (a: number, b: number, px: number): sheets_v4.Schema$Request => ({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: a, endIndex: b }, properties: { pixelSize: px }, fields: "pixelSize" } });
  requests.push(col(0, 1, 160), col(1, 2, 160), col(2, 3, 439), col(3, 4, 103), col(4, 5, 31));
  if (lastActiveColumn > 5) requests.push(col(5, lastActiveColumn, 127));
  requests.push(row(0, 1, 32), row(1, 5, 25), row(5, 6, 19), row(6, 7, 29), row(7, rowCount, 19));

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}
