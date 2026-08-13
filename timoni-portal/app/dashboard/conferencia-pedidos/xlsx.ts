export type Divergencia =
  | "preco"
  | "ipi"
  | "preco_bruto"
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
  documentos_pedido: string[];
  documentos_fornecedor: Array<{
    arquivo: string;
    identificador: string;
    pedido_relacionado: string;
    gerado_em: string;
    status: "considerado" | "substituido" | "indeterminado";
    substitui: string;
  }>;
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
    ipi_mcr: number | null;
    ipi_fornecedor: number | null;
    preco_bruto_mcr: number | null;
    preco_bruto_fornecedor: number | null;
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

function numberCell(
  ref: string,
  value: number | null | undefined,
  style = 7,
  missing = "—",
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    const fallbackStyle = [4, 5, 9, 15, 16, 17].includes(style) ? 11 : style;
    return textCell(ref, missing, fallbackStyle);
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

function splitSummary(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return [];

  const lines = raw
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1) return lines.slice(0, 5);

  const sentences = raw
    .replace(/\s+/g, " ")
    .split(/\.\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => (/[.!?]$/.test(sentence) ? sentence : `${sentence}.`));

  return sentences.length > 1 ? sentences.slice(0, 5) : [raw];
}

function rowHeightForText(value: string, base = 22, charsPerLine = 145) {
  const lines = Math.max(1, Math.ceil(String(value || "").length / charsPerLine));
  return Math.min(84, Math.max(base, lines * 18));
}

function grossPrice(price: number | null, ipi: number | null) {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  if (typeof ipi !== "number" || !Number.isFinite(ipi)) return null;
  return price * (1 + ipi / 100);
}

function buildSheet(result: ConferenciaResult) {
  const rows: string[] = [];
  const merges: string[] = [];
  let row = 1;

  const supplier = normalizeText(result.fornecedor_curto || result.fornecedor_nome);
  const pedido = normalizeText(result.pedido_numero);
  const referenceDate = normalizeText(
    result.data_documento_fornecedor || result.data_pedido,
  );
  const title = `Conferencia - Pedido MCR ${pedido} x ${supplier} (${referenceDate})`;

  rows.push(makeRow(row, [textCell(`A${row}`, title, 1)], 30));
  merges.push(`A${row}:M${row}`);
  row += 1;

  const identification = [
    `Fornecedor: ${normalizeText(result.fornecedor_nome)}`,
    `Pedido MCR: ${normalizeText(result.data_pedido)}`,
    `Documento fornecedor: ${normalizeText(result.data_documento_fornecedor)}`,
    `Frete: ${normalizeText(result.condicoes.frete_fornecedor || result.condicoes.frete_mcr)}`,
  ].join(" - ");
  rows.push(
    makeRow(
      row,
      [textCell(`A${row}`, identification, 13)],
      rowHeightForText(identification, 20, 190),
    ),
  );
  merges.push(`A${row}:M${row}`);
  row += 1;

  const payment = `Forma de pagamento — Nosso pedido: ${normalizeText(result.condicoes.pagamento_mcr)} | Fornecedor: ${normalizeText(result.condicoes.pagamento_fornecedor)}`;
  rows.push(makeRow(row, [textCell(`A${row}`, payment, 13)], rowHeightForText(payment, 22, 190)));
  merges.push(`A${row}:M${row}`);
  row += 2;

  rows.push(makeRow(row, [textCell(`A${row}`, "DOCUMENTOS RELACIONADOS", 3)], 22));
  merges.push(`A${row}:M${row}`);
  row += 1;

  for (const file of result.documentos_pedido || []) {
    const value = `Nosso pedido: ${normalizeText(file)}`;
    rows.push(makeRow(row, [textCell(`A${row}`, value, 13)], rowHeightForText(value, 22, 165)));
    merges.push(`A${row}:M${row}`);
    row += 1;
  }

  for (const document of result.documentos_fornecedor || []) {
    const status = document.status === "substituido"
      ? "VERSÃO SUBSTITUÍDA - não comparada"
      : document.status === "considerado"
        ? "VERSÃO CONSIDERADA"
        : "VERSÃO NÃO IDENTIFICADA - conferir";
    const relation = document.pedido_relacionado && document.pedido_relacionado !== "NÃO INFORMADO"
      ? ` | Relacionado ao pedido ${document.pedido_relacionado}`
      : "";
    const generated = document.gerado_em && document.gerado_em !== "NÃO INFORMADO"
      ? ` | Gerado em ${document.gerado_em}`
      : "";
    const value = `Fornecedor: ${normalizeText(document.arquivo)} | ${status}${relation}${generated}`;
    const style = document.status === "considerado" ? 18 : 6;
    rows.push(makeRow(row, [textCell(`A${row}`, value, style)], rowHeightForText(value, 22, 150)));
    merges.push(`A${row}:M${row}`);
    row += 1;
  }

  row += 2;

  const summary = splitSummary(result.resumo_texto);
  const summaryLines = summary.length
    ? [...summary]
    : [
        `Total de itens: ${result.contagens.itens_mcr} no pedido MCR / ${result.contagens.itens_fornecedor} no documento do fornecedor.`,
      ];

  const totalItemsLine = `Total de itens: ${result.contagens.itens_mcr} no pedido MCR / ${result.contagens.itens_fornecedor} no documento do fornecedor.`;
  if (!summaryLines.some((line) => /total de itens|itens no pedido/i.test(line))) {
    summaryLines.unshift(totalItemsLine);
  }

  const priceLine = `Preços divergentes: ${result.contagens.precos_divergentes} item(ns).`;
  if (
    result.contagens.precos_divergentes > 0 &&
    !summaryLines.some((line) => /preç|reajuste/i.test(line))
  ) {
    summaryLines.push(priceLine);
  }

  if (
    result.contagens.outras_divergencias > 0 &&
    !summaryLines.some((line) => /diverg|faltante|extra|quantidade|código|codigo/i.test(line))
  ) {
    summaryLines.push(
      `Outras divergências: ${result.contagens.outras_divergencias} item(ns).`,
    );
  }

  if (
    typeof result.totais.subtotal_mcr === "number" &&
    !summaryLines.some((line) => /total.*mcr|subtotal.*mcr/i.test(line))
  ) {
    summaryLines.push(`Total produtos pedido MCR: ${formatCurrency(result.totais.subtotal_mcr)}.`);
  }

  if (
    typeof result.totais.total_fornecedor === "number" &&
    !summaryLines.some((line) => /total.*fornecedor|total.*documento/i.test(line))
  ) {
    summaryLines.push(
      `Total do documento do fornecedor: ${formatCurrency(result.totais.total_fornecedor)}.`,
    );
  }

  rows.push(makeRow(row, [textCell(`A${row}`, "PONTOS DE ATENÇÃO", 2)], 24));
  merges.push(`A${row}:M${row}`);
  row += 1;

  const attention = result.pontos_atencao.length
    ? result.pontos_atencao
    : ["Nenhuma divergência relevante identificada."];
  for (const point of attention) {
    const value = `- ${normalizeText(point)}`;
    rows.push(
      makeRow(
        row,
        [textCell(`A${row}`, value, 13)],
        rowHeightForText(value, 22, 155),
      ),
    );
    merges.push(`A${row}:M${row}`);
    row += 1;
  }

  row += 2;

  const headers = [
    "P-L (local.)",
    "Cod. MCR",
    "Cod. Forn.\npedido MCR",
    `Cod. Forn.\n${supplier}`,
    "Descrição (pedido MCR)",
    "Qtd\npedido MCR",
    `Qtd\n${supplier}`,
    "Preço\npedido MCR",
    `Preço\n${supplier}`,
    "IPI %\npedido MCR",
    `IPI %\n${supplier}`,
    "Preço bruto\npedido MCR",
    `Preço bruto\n${supplier}`,
  ];
  rows.push(
    makeRow(
      row,
      headers.map((header, index) =>
        textCell(`${colName(index + 1)}${row}`, header, 14),
      ),
      42,
    ),
  );
  row += 1;

  for (const item of result.itens) {
    const divergencias = new Set(item.divergencias || []);
    const wholeOrange = [
      "item_faltante",
      "item_extra",
      "pareamento_incerto",
      "outra",
    ].some((type) => divergencias.has(type as Divergencia));

    const priceComparable =
      typeof item.preco_mcr === "number" &&
      Number.isFinite(item.preco_mcr) &&
      typeof item.preco_fornecedor === "number" &&
      Number.isFinite(item.preco_fornecedor);
    const supplierPriceHigher =
      priceComparable &&
      (item.preco_fornecedor as number) > (item.preco_mcr as number) + 0.05;
    const supplierPriceLowerOrEqual =
      priceComparable &&
      (item.preco_fornecedor as number) <= (item.preco_mcr as number) + 0.05;

    const priceSupplierStyle = divergencias.has("preco")
      ? supplierPriceHigher
        ? 5
        : supplierPriceLowerOrEqual
          ? 17
          : 9
      : wholeOrange
        ? 9
        : 4;

    const priceMcrStyle = priceComparable ? (wholeOrange ? 9 : 4) : 8;
    const priceDocumentStyle = priceComparable ? priceSupplierStyle : 8;

    const ipiComparable = typeof item.ipi_mcr === "number" && typeof item.ipi_fornecedor === "number";
    const ipiStyle = !ipiComparable || wholeOrange || divergencias.has("ipi") ? 8 : 7;
    const grossMcr = item.preco_bruto_mcr ?? grossPrice(item.preco_mcr, item.ipi_mcr);
    const grossSupplier = item.preco_bruto_fornecedor ?? grossPrice(item.preco_fornecedor, item.ipi_fornecedor);
    const grossComparable = typeof grossMcr === "number" && typeof grossSupplier === "number";
    const grossSupplierStyle = !grossComparable ? 8 : divergencias.has("preco_bruto")
      ? grossComparable && grossSupplier > grossMcr + 0.05 ? 5 : 17
      : wholeOrange ? 9 : 4;
    const grossMcrStyle = !grossComparable ? 8 : wholeOrange ? 9 : 4;

    const styles = {
      a: wholeOrange ? 6 : 21,
      b: wholeOrange ? 6 : 21,
      c: wholeOrange || divergencias.has("codigo") ? 6 : 21,
      d: wholeOrange || divergencias.has("codigo") ? 6 : 21,
      e: wholeOrange || divergencias.has("descricao") ? 6 : 22,
      f: wholeOrange || divergencias.has("quantidade") ? 8 : 7,
      g: wholeOrange || divergencias.has("quantidade") ? 8 : 7,
      h: wholeOrange ? 9 : 4,
      i: priceSupplierStyle,
    };

    const description = normalizeText(item.descricao);
    rows.push(
      makeRow(
        row,
        [
          textCell(`A${row}`, normalizeText(item.pl), styles.a),
          textCell(`B${row}`, normalizeText(item.codigo_mcr), styles.b),
          textCell(
            `C${row}`,
            normalizeText(item.codigo_fornecedor_pedido_mcr),
            styles.c,
          ),
          textCell(
            `D${row}`,
            normalizeText(item.codigo_fornecedor_documento),
            styles.d,
          ),
          textCell(`E${row}`, description, styles.e),
          numberCell(`F${row}`, item.quantidade_mcr, styles.f),
          numberCell(`G${row}`, item.quantidade_fornecedor, styles.g),
          numberCell(`H${row}`, item.preco_mcr, priceMcrStyle, "NÃO INFORMADO"),
          numberCell(`I${row}`, item.preco_fornecedor, priceDocumentStyle, "NÃO INFORMADO"),
          numberCell(`J${row}`, item.ipi_mcr, ipiStyle),
          numberCell(`K${row}`, item.ipi_fornecedor, ipiStyle),
          numberCell(`L${row}`, grossMcr, grossMcrStyle, "NÃO COMPARÁVEL"),
          numberCell(`M${row}`, grossSupplier, grossSupplierStyle, "NÃO COMPARÁVEL"),
        ],
        rowHeightForText(description, 24, 46),
      ),
    );
    row += 1;
  }

  rows.push(
    makeRow(
      row,
      [
        textCell(`A${row}`, "TOTAL DO PEDIDO", 10),
        numberCell(`L${row}`, result.totais.subtotal_mcr, 15, "NÃO INFORMADO"),
        numberCell(
          `M${row}`,
          result.totais.subtotal_fornecedor,
          15,
          "NÃO INFORMADO",
        ),
      ],
      32,
    ),
  );
  merges.push(`A${row}:K${row}`);
  row += 1;

  rows.push(
    makeRow(
      row,
      [
        textCell(`L${row}`, "Total produtos pedido MCR", 16),
        textCell(`M${row}`, `Subtotal ${supplier}`, 16),
      ],
      24,
    ),
  );
  row += 1;

  rows.push(
    makeRow(
      row,
      [
        textCell(`L${row}`, "Total forn. c/ impostos, frete e desconto:", 16),
        numberCell(
          `M${row}`,
          result.totais.total_fornecedor,
          15,
          "NÃO INFORMADO",
        ),
      ],
      42,
    ),
  );

  row += 2;
  rows.push(makeRow(row, [textCell(`A${row}`, "RESUMO DA AVALIAÇÃO", 3)], 22));
  merges.push(`A${row}:M${row}`);
  row += 1;

  for (const line of summaryLines.slice(0, 7)) {
    rows.push(makeRow(row, [textCell(`A${row}`, line, 13)], rowHeightForText(line, 22, 165)));
    merges.push(`A${row}:M${row}`);
    row += 1;
  }

  row += 1;
  rows.push(makeRow(row, [textCell(`A${row}`, "LEGENDA DE CORES", 3)], 22));
  merges.push(`A${row}:M${row}`);
  row += 1;

  const legend = [
    ["Verde: preço do fornecedor igual ou menor que o do pedido", 18],
    ["Vermelho: preço do fornecedor maior que o do pedido", 19],
    ["Laranja: divergência ou informação insuficiente para comparar", 6],
  ] as const;
  for (const [label, style] of legend) {
    rows.push(makeRow(row, [textCell(`A${row}`, label, style)], 22));
    merges.push(`A${row}:M${row}`);
    row += 1;
  }

  const lastRow = row;
  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges
        .map((ref) => `<mergeCell ref="${ref}"/>`)
        .join("")}</mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:M${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0" showGridLines="1"/></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="13" customWidth="1"/>
    <col min="2" max="2" width="13" customWidth="1"/>
    <col min="3" max="4" width="19" customWidth="1"/>
    <col min="5" max="5" width="48" customWidth="1"/>
    <col min="6" max="7" width="14" customWidth="1"/>
    <col min="8" max="9" width="16" customWidth="1"/>
    <col min="10" max="11" width="12" customWidth="1"/>
    <col min="12" max="13" width="17" customWidth="1"/>
  </cols>
  <sheetData>${rows.join("")}</sheetData>
  ${mergeXml}
  <pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/>
</worksheet>`;
}

function buildStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="&quot;R$ &quot;#,##0.00"/>
  </numFmts>
  <fonts count="8">
    <font><sz val="12"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FF1A3A6B"/><sz val="16"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="12"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FF1A3A6B"/><sz val="12"/><name val="Calibri"/><family val="2"/></font>
    <font><i/><color rgb="FF666666"/><sz val="10"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="12"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="12"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFBF9000"/><sz val="12"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1A3A6B"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFBF9000"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFA726"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE53935"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF66BB6A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCCCCCC"/></left>
      <right style="thin"><color rgb="FFCCCCCC"/></right>
      <top style="thin"><color rgb="FFCCCCCC"/></top>
      <bottom style="thin"><color rgb="FFCCCCCC"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="23">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="6" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="5" fillId="7" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="5" fillId="7" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="5" fillId="6" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="5" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
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
