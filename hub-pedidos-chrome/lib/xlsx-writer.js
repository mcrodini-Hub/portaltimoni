// Gerador mínimo de .xlsx (OOXML/SpreadsheetML), sem dependências externas — só o
// necessário para uma única planilha com células de texto/número. Usado para exportar o
// registro da conferência (Etapa 5) num arquivo que a usuária encaminha ao financeiro.
//
// Por que na mão em vez de uma lib pronta (ex: SheetJS): este projeto não tem build step
// (tudo é <script> direto, ver README) e o ambiente de desenvolvimento não tem acesso à
// rede para vendorizar um arquivo de terceiros. Um .xlsx válido é só um .zip com XML
// dentro; para uma planilha pequena e sem compressão (STORED), isso cabe em ~150 linhas
// sem depender de nada além de TextEncoder/Blob, que já são padrão do navegador.

(function (root) {
  // ---------------------------------------------------------------------------
  // CRC32 (necessário pelo formato ZIP em cada entrada, mesmo sem compressão)
  // ---------------------------------------------------------------------------
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  // ---------------------------------------------------------------------------
  // ZIP (somente STORED, sem compressão — arquivos pequenos, simplicidade > tamanho)
  // ---------------------------------------------------------------------------
  function u16(view, offset, value) { view.setUint16(offset, value, true); }
  function u32(view, offset, value) { view.setUint32(offset, value, true); }

  function buildZip(files) {
    // files: [{ name: string, data: Uint8Array }]
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    files.forEach((file) => {
      const nameBytes = encoder.encode(file.name);
      const data = file.data;
      const crc = crc32(data);

      const localHeader = new ArrayBuffer(30);
      const lv = new DataView(localHeader);
      u32(lv, 0, 0x04034b50); // local file header signature
      u16(lv, 4, 20); // version needed
      u16(lv, 6, 0); // flags
      u16(lv, 8, 0); // compression = stored
      u16(lv, 10, 0); // mod time
      u16(lv, 12, 0); // mod date
      u32(lv, 14, crc);
      u32(lv, 18, data.length); // compressed size
      u32(lv, 22, data.length); // uncompressed size
      u16(lv, 26, nameBytes.length);
      u16(lv, 28, 0); // extra length

      localParts.push(new Uint8Array(localHeader), nameBytes, data);

      const centralHeader = new ArrayBuffer(46);
      const cv = new DataView(centralHeader);
      u32(cv, 0, 0x02014b50); // central directory signature
      u16(cv, 4, 20); // version made by
      u16(cv, 6, 20); // version needed
      u16(cv, 8, 0); // flags
      u16(cv, 10, 0); // compression
      u16(cv, 12, 0); // mod time
      u16(cv, 14, 0); // mod date
      u32(cv, 16, crc);
      u32(cv, 20, data.length);
      u32(cv, 24, data.length);
      u16(cv, 28, nameBytes.length);
      u16(cv, 30, 0); // extra length
      u16(cv, 32, 0); // comment length
      u16(cv, 34, 0); // disk number start
      u16(cv, 36, 0); // internal attrs
      u32(cv, 38, 0); // external attrs
      u32(cv, 42, offset); // offset of local header

      centralParts.push(new Uint8Array(centralHeader), nameBytes);

      offset += localHeader.byteLength + nameBytes.length + data.length;
    });

    const centralStart = offset;
    let centralSize = 0;
    centralParts.forEach((part) => { centralSize += part.length; });

    const eocd = new ArrayBuffer(22);
    const ev = new DataView(eocd);
    u32(ev, 0, 0x06054b50); // end of central directory signature
    u16(ev, 4, 0); // disk number
    u16(ev, 6, 0); // disk with central directory
    u16(ev, 8, files.length); // entries on this disk
    u16(ev, 10, files.length); // total entries
    u32(ev, 12, centralSize);
    u32(ev, 16, centralStart);
    u16(ev, 20, 0); // comment length

    const allParts = [...localParts, ...centralParts, new Uint8Array(eocd)];
    const totalLength = allParts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(totalLength);
    let pos = 0;
    allParts.forEach((part) => { result.set(part, pos); pos += part.length; });
    return result;
  }

  // ---------------------------------------------------------------------------
  // OOXML mínimo — uma planilha só, células como inlineStr (texto) ou número.
  // ---------------------------------------------------------------------------
  function escapeXml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function columnLetter(index) {
    // index é 1-based (coluna 1 = A)
    let letter = '';
    let n = index;
    while (n > 0) {
      const rem = (n - 1) % 26;
      letter = String.fromCharCode(65 + rem) + letter;
      n = Math.floor((n - 1) / 26);
    }
    return letter;
  }

  function cellXml(rowIndex, colIndex, value) {
    const ref = `${columnLetter(colIndex)}${rowIndex}`;
    if (value === null || value === undefined || value === '') {
      return '';
    }
    if (typeof value === 'number' && isFinite(value)) {
      return `<c r="${ref}"><v>${value}</v></c>`;
    }
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  }

  function rowsToSheetXml(rows) {
    const rowsXml = rows.map((row, i) => {
      const rowIndex = i + 1;
      const cells = row.map((value, j) => cellXml(rowIndex, j + 1, value)).join('');
      return `<row r="${rowIndex}">${cells}</row>`;
    }).join('');
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<sheetData>${rowsXml}</sheetData>` +
      '</worksheet>'
    );
  }

  function workbookXml(sheetName) {
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
      '</workbook>'
    );
  }

  const CONTENT_TYPES_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>';

  const ROOT_RELS_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const WORKBOOK_RELS_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  // Estilo mínimo (uma fonte/preenchimento/borda padrão) — algumas implementações
  // (LibreOffice incluído) rejeitam um pacote sem xl/styles.xml, mesmo que nenhuma
  // célula use formatação especial.
  const STYLES_XML =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
    '</styleSheet>';

  // Monta os bytes do .xlsx a partir de uma matriz de linhas (cada linha é um array de
  // valores string/number/null). Função pura — sem tocar em Blob/DOM — para poder ser
  // testada fora do navegador.
  function buildXlsxBytes(sheetName, rows) {
    const encoder = new TextEncoder();
    const files = [
      { name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES_XML) },
      { name: '_rels/.rels', data: encoder.encode(ROOT_RELS_XML) },
      { name: 'xl/workbook.xml', data: encoder.encode(workbookXml(sheetName)) },
      { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(WORKBOOK_RELS_XML) },
      { name: 'xl/styles.xml', data: encoder.encode(STYLES_XML) },
      { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(rowsToSheetXml(rows)) }
    ];
    return buildZip(files);
  }

  // Dispara o download no navegador (contexto da sidebar). Não usado em testes Node.
  function downloadXlsx(filename, sheetName, rows) {
    const bytes = buildXlsxBytes(sheetName, rows);
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  root.HubXlsx = { buildXlsxBytes, downloadXlsx, columnLetter };
})(typeof self !== 'undefined' ? self : this);
