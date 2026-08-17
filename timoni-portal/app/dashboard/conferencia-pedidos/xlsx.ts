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
  const rows: string[] = [], merges: string[] = [];
  const supplier = normalizeText(result.fornecedor_curto || result.fornecedor_nome);
  const pedido = normalizeText(result.pedido_numero);
  const pedidoDisplay = /(?:MCR|ROD)$/i.test(pedido) ? pedido : `${pedido}MCR`;
  const docs = (result.documentos_fornecedor || []).filter((d) => d.status === "considerado");
  const files = [...(result.documentos_pedido || []), ...docs.map((d) => d.arquivo)].map(normalizeText);
  const docInfo = docs.map((d) => [d.identificador === "NÃO INFORMADO" ? "" : d.identificador, d.gerado_em === "NÃO INFORMADO" ? "" : d.gerado_em].filter(Boolean).join(" - ")).filter(Boolean).join(" | ") || normalizeText(result.data_documento_fornecedor);
  const add = (r: number, cells: string[], height = 18) => rows.push(makeRow(r, cells, height));

  add(1,[textCell("A1",`CONFERÊNCIA DE PREÇOS - PEDIDO ${pedido} - ${supplier}`,29)],30); merges.push("A1:N1");
  const dl=`DOCUMENTOS CONSIDERADOS: ${files.join(" | ") || "SEM DADOS"}`;
  add(2,[textCell("A2",dl,30)],rowHeightForText(dl,22,180)); merges.push("A2:N2");
  add(3,[textCell("A3","Pedido Casa Timoni",31),textCell("B3",pedidoDisplay,13),textCell("C3","Data do pedido",31),textCell("D3",normalizeText(result.data_pedido),13)],22); merges.push("D3:E3");
  add(4,[],14);
  add(5,[textCell("A5","Fornecedor",31),textCell("B5",normalizeText(result.fornecedor_nome),13),textCell("E5",docInfo,13)],28); merges.push("B5:D5","E5:H5");
  add(6,[],14);
  add(7,[textCell("A7","Forma de pagamento fornecedor:",31),textCell("D7",normalizeText(result.condicoes.pagamento_fornecedor),13)],22); merges.push("A7:C7","D7:F7");
  add(8,[],14);
  add(9,[textCell("A9","Data de Entrega",31),textCell("B9",normalizeText(result.condicoes.entrega_mcr || result.condicoes.entrega_fornecedor),13)],22); merges.push("B9:F9");
  add(10,[],14); add(11,[textCell("A11","PONTOS DE ATENÇÃO",23)],22); merges.push("A11:N11");
  const attention=(result.pontos_atencao.length?result.pontos_atencao:["Nenhuma divergência relevante identificada."]).slice(0,3);
  for(let i=0;i<3;i++){const r=12+i,p=attention[i]||"";add(r,p?[textCell(`A${r}`,normalizeText(p),32)]:[],p?rowHeightForText(p,22,170):18);if(p)merges.push(`A${r}:N${r}`);}
  add(15,[]);add(16,[]);add(17,[]);
  const headers=["P-L (local.)","Cód. MCR","Cód. forn. pedido","Cód. forn. documento","Descrição / especificações","Qtd. pedido","Qtd. fornecedor","Preço pedido","Preço fornecedor","IPI pedido","IPI fornecedor","Preço bruto pedido","Preço bruto fornecedor","Conferência"];
  add(18,headers.map((h,i)=>textCell(`${colName(i+1)}18`,h,14)),42);
  let row=19;
  for(const item of result.itens){
    const d=new Set(item.divergencias||[]), price=d.has("preco"), other=[...d].some(x=>x!=="preco"), orange=["item_faltante","item_extra","pareamento_incerto","outra"].some(x=>d.has(x as Divergencia));
    const grossM=item.preco_bruto_mcr??grossPrice(item.preco_mcr,item.ipi_mcr), grossF=item.preco_bruto_fornecedor??grossPrice(item.preco_fornecedor,item.ipi_fornecedor);
    const ts=orange?6:21, qs=orange||d.has("quantidade")?8:7, ips=orange||d.has("ipi")?8:7, ps=price?26:4;
    add(row,[
      textCell(`A${row}`,normalizeText(item.pl),ts),textCell(`B${row}`,normalizeText(item.codigo_mcr),ts),
      textCell(`C${row}`,normalizeText(item.codigo_fornecedor_pedido_mcr),orange||d.has("codigo")?6:21),
      textCell(`D${row}`,normalizeText(item.codigo_fornecedor_documento),orange||d.has("codigo")?6:21),
      textCell(`E${row}`,normalizeText(item.descricao),orange||d.has("descricao")?6:22),
      numberCell(`F${row}`,item.quantidade_mcr,qs),numberCell(`G${row}`,item.quantidade_fornecedor,qs),
      numberCell(`H${row}`,item.preco_mcr,ps,"SEM DADOS"),numberCell(`I${row}`,item.preco_fornecedor,ps,"SEM DADOS"),
      numberCell(`J${row}`,item.ipi_mcr,ips,"SEM DADOS"),numberCell(`K${row}`,item.ipi_fornecedor,ips,"SEM DADOS"),
      numberCell(`L${row}`,grossM,ps,"SEM DADOS"),numberCell(`M${row}`,grossF,ps,"SEM DADOS"),
      textCell(`N${row}`,price?"PREÇO DIVERGENTE":other?"OUTRA DIVERGÊNCIA":"OK",price||other?24:25)
    ],rowHeightForText(item.descricao,28,48));row++;
  }
  row++;
  const base=result.totais.subtotal_mcr, total=result.totais.total_fornecedor??result.totais.subtotal_fornecedor;
  const diff=typeof base==="number"&&typeof total==="number"?total-base:null;
  add(row,[textCell(`A${row}`,"TOTAIS DOS DOCUMENTOS",33),numberCell(`H${row}`,base,27,"SEM DADOS"),numberCell(`I${row}`,total,27,"SEM DADOS"),textCell(`J${row}`,`Diferença: ${formatCurrency(diff)}`,28)],24);
  merges.push(`A${row}:G${row}`,`J${row}:M${row}`);
  row+=3;add(row,[textCell(`A${row}`,"RESUMO DA CONFERÊNCIA",31)],22);merges.push(`A${row}:N${row}`);
  row++;add(row,[textCell(`A${row}`,normalizeText(result.resumo_texto),13)],rowHeightForText(result.resumo_texto,38,180));merges.push(`A${row}:N${row}`);
  const mergeXml=`<mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:N${row}"/><sheetViews><sheetView workbookViewId="0" showGridLines="1"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="18" customWidth="1"/><col min="2" max="2" width="14" customWidth="1"/><col min="3" max="4" width="18" customWidth="1"/><col min="5" max="5" width="40" customWidth="1"/><col min="6" max="7" width="14" customWidth="1"/><col min="8" max="9" width="15" customWidth="1"/><col min="10" max="11" width="12" customWidth="1"/><col min="12" max="13" width="17" customWidth="1"/><col min="14" max="14" width="20" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData>${mergeXml}<pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.2" footer="0.2"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/></worksheet>`;
}
function buildStyles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="&quot;R$ &quot;#,##0.00"/>
  </numFmts>
  <fonts count="11">
    <font><sz val="12"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FF1A3A6B"/><sz val="16"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="12"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FF1A3A6B"/><sz val="12"/><name val="Calibri"/><family val="2"/></font>
    <font><i/><color rgb="FF666666"/><sz val="10"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="12"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="12"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFBF9000"/><sz val="12"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FFE53935"/><sz val="12"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><color rgb="FF7F0000"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>\n    <font><b/><color rgb="FF006100"/><sz val="11"/><name val="Calibri"/><family val="2"/></font>\n  </fonts>
  <fills count="11">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1A3A6B"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFBF9000"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFA726"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE53935"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF66BB6A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF4B183"/><bgColor indexed="64"/></patternFill></fill>\n    <fill><patternFill patternType="solid"><fgColor rgb="FFC6E0B4"/><bgColor indexed="64"/></patternFill></fill>\n    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>\n  </fills>
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
  <cellXfs count="34">
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
    <xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="9" fillId="8" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="10" fillId="9" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="10" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="5" fillId="7" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="9" fillId="8" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="7" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
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
