export type Divergencia =
  | "preco"
  | "quantidade"
  | "codigo"
  | "descricao"
  | "item_faltante"
  | "item_extra"
  | "pareamento_incerto"
  | "outra";

export type ConferenciaResult = {
  pedido_numero: string;
  fornecedor_curto: string;
  fornecedor_nome: string;
  data_pedido: string;
  data_documento_fornecedor: string;
  resumo_texto: string;
  pontos_atencao: string[];
  contagens: {
    itens_mcr: number;
    itens_fornecedor: number;
    precos_divergentes: number;
    outras_divergencias: number;
  };
  totais: {
    subtotal_mcr: number | null;
    subtotal_fornecedor: number | null;
    impostos_fornecedor: number | null;
    frete_fornecedor: number | null;
    desconto_fornecedor: number | null;
    total_fornecedor: number | null;
  };
  condicoes: {
    pagamento_mcr: string;
    pagamento_fornecedor: string;
    entrega_mcr: string;
    entrega_fornecedor: string;
    frete_mcr: string;
    frete_fornecedor: string;
  };
  itens: Array<{
    pl: string;
    codigo_mcr: string;
    codigo_fornecedor_pedido_mcr: string;
    codigo_fornecedor_documento: string;
    descricao: string;
    quantidade_mcr: number | null;
    quantidade_fornecedor: number | null;
    preco_mcr: number | null;
    preco_fornecedor: number | null;
    divergencias: Divergencia[];
    observacao: string;
  }>;
};

type ZipEntry = { name: string; data: Uint8Array };

const encoder = new TextEncoder();

function xml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function colName(index: number) {
  let value = index;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function textCell(ref: string, value: unknown, style = 11) {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function numberCell(ref: string, value: number | null | undefined, style = 7) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return textCell(ref, "NÃO INFORMADO", style === 4 || style === 5 || style === 9 ? 11 : style);
  }
  return `<c r="${ref}" s="${style}" t="n"><v>${value}</v></c>`;
}

function makeRow(row: number, cells: string[], height?: number) {
  const ht = height ? ` ht="${height}" customHeight="1"` : "";
  return `<row r="${row}"${ht}>${cells.join("")}</row>`;
}

function normalizeText(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed || "NÃO INFORMADO";
}

function buildSheet(result: ConferenciaResult) {
  const rows: string[] = [];
  const merges: string[] = [];
  let row = 1;

  const supplier = normalizeText(result.fornecedor_curto || result.fornecedor_nome);
  const title = `CONFERÊNCIA - PEDIDO MCR ${normalizeText(result.pedido_numero)} x ${supplier}`;
  rows.push(makeRow(row, [textCell(`A${row}`, title, 1)], 28));
  merges.push(`A${row}:I${row}`);
  row += 1;

  const identification = `Pedido: ${normalizeText(result.pedido_numero)} | Fornecedor: ${normalizeText(result.fornecedor_nome)} | Data pedido: ${normalizeText(result.data_pedido)} | Data fornecedor: ${normalizeText(result.data_documento_fornecedor)}`;
  rows.push(makeRow(row, [textCell(`A${row}`, identification, 11)], 34));
  merges.push(`A${row}:I${row}`);
  row += 2;

  rows.push(makeRow(row, [textCell(`A${row}`, "RESUMO", 2)]));
  merges.push(`A${row}:I${row}`);
  row += 1;

  const summaryLines: Array<[string, string]> = [
    ["Resultado", normalizeText(result.resumo_texto)],
    ["Itens", `${result.contagens.itens_mcr} no pedido MCR | ${result.contagens.itens_fornecedor} no documento do fornecedor`],
    ["Divergências", `${result.contagens.precos_divergentes} preço(s) diferente(s) | ${result.contagens.outras_divergencias} outra(s) divergência(s)`],
    ["Subtotal MCR", formatCurrency(result.totais.subtotal_mcr)],
    ["Subtotal fornecedor", formatCurrency(result.totais.subtotal_fornecedor)],
    ["Total fornecedor", formatCurrency(result.totais.total_fornecedor)],
  ];

  for (const [label, value] of summaryLines) {
    rows.push(makeRow(row, [textCell(`A${row}`, label, 10), textCell(`B${row}`, value, 12)], label === "Resultado" ? 42 : 24));
    merges.push(`B${row}:I${row}`);
    row += 1;
  }

  row += 1;
  rows.push(makeRow(row, [textCell(`A${row}`, "PONTOS DE ATENÇÃO", 2)]));
  merges.push(`A${row}:I${row}`);
  row += 1;

  const attention = result.pontos_atencao.length
    ? result.pontos_atencao
    : ["Nenhuma divergência relevante identificada."];
  for (let i = 0; i < attention.length; i += 1) {
    rows.push(makeRow(row, [textCell(`A${row}`, `${i + 1}. ${attention[i]}`, 11)], 30));
    merges.push(`A${row}:I${row}`);
    row += 1;
  }

  row += 1;
  const headerRow = row;
  const headers = [
    "P-L (local.)",
    "Cod. MCR",
    "Cod. Forn. pedido MCR",
    `Cod. Forn. ${supplier}`,
    "Descrição (pedido MCR)",
    "Qtd pedido MCR",
    `Qtd ${supplier}`,
    "Preço pedido MCR",
    `Preço ${supplier}`,
  ];
  rows.push(makeRow(row, headers.map((header, index) => textCell(`${colName(index + 1)}${row}`, header, 3)), 42));
  row += 1;

  const dataStartRow = row;
  for (const item of result.itens) {
    const divergencias = new Set(item.divergencias || []);
    const wholeOrange = ["item_faltante", "item_extra", "pareamento_incerto", "outra"].some((type) =>
      divergencias.has(type as Divergencia),
    );

    const styles = {
      a: wholeOrange ? 6 : 11,
      b: wholeOrange ? 6 : 11,
      c: wholeOrange || divergencias.has("codigo") ? 6 : 11,
      d: wholeOrange || divergencias.has("codigo") ? 6 : 11,
      e: wholeOrange || divergencias.has("descricao") ? 6 : 11,
      f: wholeOrange || divergencias.has("quantidade") ? 8 : 7,
      g: wholeOrange || divergencias.has("quantidade") ? 8 : 7,
      h: divergencias.has("preco") ? 5 : wholeOrange ? 9 : 4,
      i: divergencias.has("preco") ? 5 : wholeOrange ? 9 : 4,
    };

    rows.push(
      makeRow(
        row,
        [
          textCell(`A${row}`, item.pl, styles.a),
          textCell(`B${row}`, item.codigo_mcr, styles.b),
          textCell(`C${row}`, item.codigo_fornecedor_pedido_mcr, styles.c),
          textCell(`D${row}`, item.codigo_fornecedor_documento, styles.d),
          textCell(`E${row}`, item.descricao, styles.e),
          numberCell(`F${row}`, item.quantidade_mcr, styles.f),
          numberCell(`G${row}`, item.quantidade_fornecedor, styles.g),
          numberCell(`H${row}`, item.preco_mcr, styles.h),
          numberCell(`I${row}`, item.preco_fornecedor, styles.i),
        ],
        30,
      ),
    );
    row += 1;
  }

  const dataEndRow = Math.max(dataStartRow, row - 1);
  rows.push(
    makeRow(row, [
      textCell(`A${row}`, "TOTAL DO PEDIDO", 10),
      textCell(`B${row}`, "", 10),
      textCell(`C${row}`, "", 10),
      textCell(`D${row}`, "", 10),
      textCell(`E${row}`, "", 10),
      textCell(`F${row}`, "", 10),
      textCell(`G${row}`, "", 10),
      numberCell(`H${row}`, result.totais.subtotal_mcr, 4),
      numberCell(`I${row}`, result.totais.subtotal_fornecedor, 4),
    ]),
  );
  row += 2;

  rows.push(makeRow(row, [textCell(`A${row}`, "CONDIÇÕES COMERCIAIS", 2)]));
  merges.push(`A${row}:I${row}`);
  row += 1;

  rows.push(makeRow(row, [
    textCell(`A${row}`, "Campo", 3),
    textCell(`B${row}`, "Pedido MCR", 3),
    textCell(`E${row}`, "Documento do fornecedor", 3),
  ]));
  merges.push(`B${row}:D${row}`, `E${row}:I${row}`);
  row += 1;

  const conditions: Array<[string, string, string]> = [
    ["Pagamento", result.condicoes.pagamento_mcr, result.condicoes.pagamento_fornecedor],
    ["Entrega", result.condicoes.entrega_mcr, result.condicoes.entrega_fornecedor],
    ["Frete", result.condicoes.frete_mcr, result.condicoes.frete_fornecedor],
    ["Impostos", "Conforme pedido", formatCurrency(result.totais.impostos_fornecedor)],
    ["Desconto", "Conforme pedido", formatCurrency(result.totais.desconto_fornecedor)],
  ];

  for (const [label, mcr, provider] of conditions) {
    rows.push(makeRow(row, [
      textCell(`A${row}`, label, 10),
      textCell(`B${row}`, normalizeText(mcr), 11),
      textCell(`E${row}`, normalizeText(provider), 11),
    ], 28));
    merges.push(`B${row}:D${row}`, `E${row}:I${row}`);
    row += 1;
  }

  row += 1;
  rows.push(makeRow(row, [
    textCell(`A${row}`, "LEGENDA", 10),
    textCell(`B${row}`, "Preço unitário divergente", 13),
    textCell(`D${row}`, "Outras divergências", 6),
  ]));
  merges.push(`B${row}:C${row}`, `D${row}:E${row}`);

  const lastRow = row;
  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:I${lastRow}"/>
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="14" customWidth="1"/>
    <col min="2" max="2" width="14" customWidth="1"/>
    <col min="3" max="4" width="22" customWidth="1"/>
    <col min="5" max="5" width="48" customWidth="1"/>
    <col min="6" max="7" width="17" customWidth="1"/>
    <col min="8" max="9" width="18" customWidth="1"/>
  </cols>
  <sheetData>${rows.join("")}</sheetData>
  <autoFilter ref="A${headerRow}:I${dataEndRow}"/>
  ${mergeXml}
  <pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
</worksheet>`;
}

function buildStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/></numFmts>
  <fonts count="4">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="16"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF17365D"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF4B183"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right><top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="14">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "NÃO INFORMADO";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function zip(entries: ZipEntry[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const { dosTime, dosDate } = dosDateTime(new Date());
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);

    offset += local.length + data.length;
  }

  const centralDirectory = concat(centralParts);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirectory.length, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return concat([...localParts, centralDirectory, end]);
}

function encoded(name: string, content: string): ZipEntry {
  return { name, data: encoder.encode(content) };
}

function safeSupplier(value: string) {
  const normalized = String(value || "fornecedor")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
  return normalized || "fornecedor";
}

function fileDate() {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function createWorkbook(result: ConferenciaResult) {
  const sheetName = `Conferencia ${result.pedido_numero || "pedido"}`.slice(0, 31);
  const now = new Date().toISOString();
  const files: ZipEntry[] = [
    encoded(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
    ),
    encoded(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
    ),
    encoded(
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${xml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    ),
    encoded(
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    ),
    encoded("xl/worksheets/sheet1.xml", buildSheet(result)),
    encoded("xl/styles.xml", buildStyles()),
    encoded(
      "docProps/core.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xml(`Conferência pedido ${result.pedido_numero}`)}</dc:title>
  <dc:creator>Portal Timoni</dc:creator>
  <cp:lastModifiedBy>Portal Timoni</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`,
    ),
    encoded(
      "docProps/app.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Portal Timoni</Application>
  <TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${xml(sheetName)}</vt:lpstr></vt:vector></TitlesOfParts>
</Properties>`,
    ),
  ];

  const data = zip(files);
  const supplier = safeSupplier(result.fornecedor_curto || result.fornecedor_nome);
  const pedido = String(result.pedido_numero || "pedido").replace(/[^a-zA-Z0-9-]/g, "");
  const filename = `${fileDate()} conferencia pedido ${pedido || "pedido"} mcr ${supplier}.xlsx`;
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return { blob, filename };
}

export function downloadWorkbook(result: ConferenciaResult) {
  const { blob, filename } = createWorkbook(result);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
