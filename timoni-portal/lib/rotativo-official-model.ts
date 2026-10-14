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

export async function applyOfficialRotativoModel(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "properties(title),sheets.properties(sheetId,title,gridProperties)",
  });
  const sheet = meta.data.sheets?.find((item) => item.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) throw new Error("A aba selecionada não foi encontrada.");

  const rowCount = Math.max(1000, sheet?.properties?.gridProperties?.rowCount || 1000);
  const columnCount = Math.max(10, sheet?.properties?.gridProperties?.columnCount || 10);
  const q = `'${sheetName.replace(/'/g, "''")}'`;

  // Leia a planilha antes de qualquer transformação. Funcionário e data podem estar em qualquer célula do topo.
  let read = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${q}!A1:${colLetter(Math.min(columnCount, 26) - 1)}40`,
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
  if (!originalDate) {
    originalDate = topRows.flat().find(isDateLike) ?? "";
  }

  // Se a planilha já passou pelo novo modelo, preserve A4/A5 exatamente como estão.
  if (originalWasOfficial && headerIndex === 6) {
    employee = String(values[3]?.[0] ?? employee).trim();
    originalDate = values[4]?.[0] ?? originalDate;
  }

  const previousRotativoUpdate = topRows
    .flat()
    .map((value) => String(value ?? "").trim())
    .find((value) => /(?:estoque\s+)?rotativo\s+atualizado\s+em/i.test(value)) || "";
  const normalizedUpdate = previousRotativoUpdate
    ? previousRotativoUpdate.replace(/^Rotativo atualizado em/i, "Estoque Rotativo atualizado em")
    : "";

  // O cabeçalho oficial precisa estar exatamente na linha 7. Insira apenas as linhas que faltam.
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

  // Releia após o deslocamento. O cabeçalho e os produtos agora começam em 7 e 8.
  read = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${q}!A1:${colLetter(columnCount - 1)}${rowCount}`,
    valueRenderOption: "FORMULA",
  });
  values = read.data.values || [];
  const header = values[6] || [];

  // Planilha original com ITEM | CODIGO: o CODIGO vira VENDA e COMPRA fica vazio.
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

  // Limpe resíduos antigos do topo. O padrão oficial permite conteúdo somente em A1:A5 e contadores em F6+.
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

  const data: Array<{ range: string; values: unknown[][] }> = [
    { range: `${q}!A1`, values: [[supplierName]] },
    { range: `${q}!A2`, values: [[`Padronizada em ${standardizedAt}`]] },
    { range: `${q}!A3`, values: [[normalizedUpdate]] },
    { range: `${q}!A4`, values: [[employee]] },
    { range: `${q}!A5`, values: [[originalDate]] },
    { range: `${q}!A7:E7`, values: [["VENDA", "COMPRA", "DESCRIÇÃO", "ESTOQUE", "UN"]] },
  ];

  const historyColumns = header
    .map((value, index) => ({ value, index }))
    .filter(({ value, index }) => index >= 5 && String(value ?? "").trim() !== "")
    .map(({ index }) => index);
  for (const c of historyColumns) {
    const letter = colLetter(c);
    data.push({ range: `${q}!${letter}6`, values: [[`=COUNTA(${letter}8:${letter}${rowCount})`]] });
  }
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });

  const white = { red: 1, green: 1, blue: 1 };
  const black = { red: 0, green: 0, blue: 0 };
  const red = { red: 0.831, green: 0.047, blue: 0.051 };
  const blue = { red: 0.075, green: 0.012, blue: 0.553 };
  const requests: sheets_v4.Schema$Request[] = [
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 6, startColumnIndex: 0, endColumnIndex: columnCount }, cell: { userEnteredFormat: { backgroundColor: white, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: false, foregroundColor: black }, horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", wrapStrategy: "OVERFLOW_CELL" } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: white, textFormat: { fontFamily: "Calibri", fontSize: 16, bold: true, foregroundColor: black }, horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", wrapStrategy: "OVERFLOW_CELL" } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 2 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.859, green: 0.914, blue: 0.969 }, textFormat: { fontFamily: "Calibri", fontSize: 10, bold: false, foregroundColor: black }, horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", wrapStrategy: "OVERFLOW_CELL" } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 2 }, cell: { userEnteredFormat: { backgroundColor: { red: 1, green: 0.902, blue: 0.6 }, textFormat: { fontFamily: "Calibri", fontSize: 10, bold: false, foregroundColor: black }, horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", wrapStrategy: "OVERFLOW_CELL" } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 3, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: white, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: red }, horizontalAlignment: "LEFT", verticalAlignment: "MIDDLE", wrapStrategy: "OVERFLOW_CELL" } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" } } }, fields: "userEnteredFormat.numberFormat" } },
    { repeatCell: { range: { sheetId, startRowIndex: 5, endRowIndex: 6, startColumnIndex: 0, endColumnIndex: columnCount }, cell: { userEnteredFormat: { backgroundColor: white, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: black }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: columnCount }, cell: { userEnteredFormat: { backgroundColor: blue, textFormat: { fontFamily: "Calibri", fontSize: 11, bold: true, foregroundColor: white }, horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 7, endRowIndex: rowCount, startColumnIndex: 5, endColumnIndex: columnCount }, cell: { userEnteredFormat: { numberFormat: { type: "TEXT", pattern: "@" } } }, fields: "userEnteredFormat.numberFormat" } },
    { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 7 } }, fields: "gridProperties.frozenRowCount" } },
  ];

  const col = (a: number, b: number, px: number): sheets_v4.Schema$Request => ({ updateDimensionProperties: { range: { sheetId, dimension: "COLUMNS", startIndex: a, endIndex: b }, properties: { pixelSize: px }, fields: "pixelSize" } });
  const row = (a: number, b: number, px: number): sheets_v4.Schema$Request => ({ updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: a, endIndex: b }, properties: { pixelSize: px }, fields: "pixelSize" } });
  requests.push(col(0, 1, 160), col(1, 2, 160), col(2, 3, 439), col(3, 4, 103), col(4, 5, 31), col(5, columnCount, 127));
  requests.push(row(0, 1, 32), row(1, 5, 25), row(5, 6, 19), row(6, 7, 29), row(7, rowCount, 19));
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}
