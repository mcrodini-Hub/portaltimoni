// Use: node scripts/validate-rotativo.mjs before.json after.json second.json
// CI: node scripts/validate-rotativo.mjs --fixtures
import fs from 'node:fs';
import assert from 'node:assert/strict';

const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const raw = cell => cell?.userEnteredValue || {};
const displayed = cell => String(cell?.formattedValue ?? cell?.userEnteredValue?.stringValue ?? '');
const numberFormat = cell => cell?.userEnteredFormat?.numberFormat || {};
const sheet = (doc, title) => doc.sheets.find(item => item.properties.title === (title || doc.targetSheet || 'MODELO'));
const rows = item => item.data[0].rowData.map(row => row.values || []);

function validate(before, after, second) {
  const sourceSheet = sheet(before);
  const outputSheet = sheet(after);
  const secondSheet = sheet(second);
  const sourceRows = rows(sourceSheet);
  const outputRows = rows(outputSheet);
  const secondRows = rows(secondSheet);
  const sourceHeader = sourceRows.findIndex(row => row.some(cell => norm(displayed(cell)) === 'estoque'));
  assert.ok(sourceHeader >= 0, 'Cabeçalho original não encontrado.');
  const sourceNames = sourceRows[sourceHeader].map(cell => norm(displayed(cell)));
  const aliases = [['venda', 'codigo'], ['compra'], ['descricao'], ['emb', 'embalagem'], ['estoque'], ['un', 'unidade']];
  const core = aliases.map(names => sourceNames.findIndex(name => names.includes(name)));
  const excluded = sourceNames.map((name, index) => ['item', 'min', 'minimo', 'max', 'maximo', 'estoque minimo', 'estoque maximo'].includes(name) ? index : -1).filter(index => index >= 0);
  let width = Math.max(1, ...sourceRows.slice(sourceHeader).map(row => {
    let end = row.length;
    while (end && !Object.keys(raw(row[end - 1])).length) end--;
    return end;
  }));
  const histories = Array.from({length: width}, (_, index) => index).filter(index => !core.includes(index) && !excluded.includes(index));
  const mapping = [...core, ...histories];
  const products = data => data.slice(7).filter(row => row.some(cell => Object.keys(raw(cell)).length));
  const outputProducts = products(outputRows);
  const lastColumn = mapping.length;
  const dataEnd = 7 + outputProducts.length;
  const validations = data => data.flat().filter(cell => cell?.dataValidation).length;
  let failed = 0;
  const check = (name, run) => {
    try {
      run();
      console.log('APROVADO | ' + name);
    } catch (error) {
      failed++;
      console.log('REPROVADO | ' + name + ': ' + error.message);
    }
  };

  check('1. Quantidade e ordem dos produtos', () => {
    const sourceProducts = sourceRows.slice(sourceHeader + 1).filter(row => row.some(cell => Object.keys(raw(cell)).length));
    assert.equal(sourceProducts.length, outputProducts.length);
    assert.deepEqual(sourceProducts.map(row => raw(row[core[2]])), outputProducts.map(row => raw(row[2])));
  });
  check('2. Códigos e zeros à esquerda', () => {
    for (let row = sourceHeader + 1; row < sourceRows.length; row++) for (let column = 0; column < 2; column++) {
      if (core[column] < 0) continue;
      const target = outputRows[row + 6 - sourceHeader]?.[column];
      assert.deepEqual(raw(sourceRows[row][core[column]]), raw(target));
      assert.equal(displayed(sourceRows[row][core[column]]), displayed(target));
    }
  });
  check('3. Valores brutos e exibidos', () => {
    for (let row = sourceHeader + 1; row < sourceRows.length; row++) for (let column = 0; column < mapping.length; column++) {
      if (mapping[column] < 0) continue;
      const target = outputRows[row + 6 - sourceHeader]?.[column];
      assert.deepEqual(raw(sourceRows[row][mapping[column]]), raw(target));
      assert.equal(displayed(sourceRows[row][mapping[column]]), displayed(target));
    }
  });
  check('4. Fórmulas existentes', () => {
    for (let row = sourceHeader + 1; row < sourceRows.length; row++) for (let column = 0; column < mapping.length; column++) {
      const source = sourceRows[row][mapping[column]];
      if (!raw(source).formulaValue || mapping[column] < 0) continue;
      const target = outputRows[row + 6 - sourceHeader]?.[column];
      assert.ok(raw(target).formulaValue);
      assert.ok(!target.effectiveValue?.errorValue);
    }
  });
  check('5. Histórico e formatos preservados', () => {
    for (let row = sourceHeader; row < sourceRows.length; row++) for (let column = 6; column < mapping.length; column++) {
      if (mapping[column] < 0) continue;
      const target = outputRows[row + 6 - sourceHeader]?.[column];
      assert.deepEqual(raw(sourceRows[row][mapping[column]]), raw(target));
      assert.deepEqual(numberFormat(sourceRows[row][mapping[column]]), numberFormat(target));
      assert.equal(displayed(sourceRows[row][mapping[column]]), displayed(target));
    }
  });
  check('6. Cabeçalho, EMB e início dos produtos', () => {
    assert.deepEqual(outputRows[6].slice(0, 6).map(displayed), ['VENDA', 'COMPRA', 'DESCRIÇÃO', 'EMB', 'ESTOQUE', 'UN']);
    assert.ok(outputProducts.length > 0, 'Produtos devem começar na linha 8.');
  });
  check('7. Bordas sólidas no cabeçalho e produtos', () => {
    for (let row = 6; row < dataEnd; row++) for (let column = 0; column < lastColumn; column++) {
      for (const edge of ['top', 'bottom', 'left', 'right']) assert.equal(outputRows[row][column].userEnteredFormat?.borders?.[edge]?.style, 'SOLID');
    }
  });
  check('8. Alinhamentos', () => {
    for (let row = 6; row < dataEnd; row++) for (let column = 0; column < lastColumn; column++) {
      assert.equal(outputRows[row][column].userEnteredFormat.horizontalAlignment, column === 2 ? 'LEFT' : 'CENTER');
      assert.equal(outputRows[row][column].userEnteredFormat.verticalAlignment, 'MIDDLE');
    }
  });
  check('9. Calibri, topo e dimensões', () => {
    assert.equal(outputRows[0][0].userEnteredFormat.textFormat.fontFamily, 'Calibri');
    assert.equal(outputRows[0][0].userEnteredFormat.textFormat.bold, true);
    for (let column = 0; column < 6; column++) assert.equal(outputRows[0][column].userEnteredFormat.textFormat.bold, true);
    assert.match(displayed(outputRows[2][0]), /^Rotativo atualizado em /, 'A3 deve receber a data e hora da atualização.');
    assert.equal(raw(sourceRows[1][0]).stringValue, raw(outputRows[1][0]).stringValue);
    assert.equal(displayed(sourceRows[3][5]), displayed(outputRows[3][6]), 'Texto G4 de histórico deve ser preservado.');
    assert.equal(displayed(sourceRows[6][5]), displayed(outputRows[6][6]), 'Datas do histórico devem permanecer em ordem.');
    for (let row = 6; row < dataEnd; row++) for (let column = 0; column < lastColumn; column++) assert.equal(outputRows[row][column].userEnteredFormat.textFormat.fontFamily, 'Calibri');
    const dimensions = outputSheet.data[0];
    assert.ok(dimensions.columnMetadata?.length >= lastColumn, 'Inclua columnMetadata no snapshot.');
    assert.equal(dimensions.columnMetadata[0].pixelSize, 143);
    assert.equal(dimensions.columnMetadata[1].pixelSize, 143);
    assert.ok(dimensions.columnMetadata[2].pixelSize > 0, 'Coluna C deve ser dimensionada automaticamente.');
    for (let column = 3; column < lastColumn; column++) assert.equal(dimensions.columnMetadata[column].pixelSize, 143);
    assert.ok(dimensions.rowMetadata?.length >= dataEnd, 'Inclua rowMetadata no snapshot.');
    assert.ok(dimensions.rowMetadata.slice(0, dataEnd).every(meta => meta.pixelSize === 17));
    assert.equal(outputSheet.properties.gridProperties.frozenRowCount, 7);
  });
  check('10. Filtros, validações e outras abas preservados', () => {
    assert.ok(outputSheet.basicFilter);
    assert.equal(outputSheet.filterViews?.length || 0, sourceSheet.filterViews?.length || 0);
    assert.equal(outputSheet.conditionalFormats?.length || 0, sourceSheet.conditionalFormats?.length || 0);
    assert.equal(outputSheet.bandedRanges?.length || 0, sourceSheet.bandedRanges?.length || 0);
    assert.equal(validations(outputRows), validations(sourceRows));
    assert.deepEqual(before.otherSheets, after.otherSheets, 'Inclua snapshots das outras abas.');
    assert.ok(before.otherSheets);
  });
  check('11. Contadores de histórico e expansão', () => {
    for (let column = 6; column < lastColumn; column++) {
      const counter = outputRows[5][column];
      assert.match(raw(counter).formulaValue, /^=COUNTA\([A-Z]+8:[A-Z]+\d+\)$/);
      assert.ok(!counter.effectiveValue?.errorValue);
      const expected = outputRows.slice(7).filter(row => Object.keys(raw(row[column])).length > 0).length;
      assert.equal(counter.effectiveValue.numberValue, expected);
    }
    assert.equal(after.expansionTest?.passed, true, 'Teste de expansão ausente.');
  });
  check('12. Segunda execução idempotente', () => {
    assert.deepEqual(outputRows, secondRows);
    assert.deepEqual(outputSheet.properties.gridProperties, secondSheet.properties.gridProperties);
  });
  return failed;
}

function fixtureCell(value, format = {}) {
  const cell = {userEnteredFormat: {textFormat: {fontFamily: 'Calibri', fontSize: 11}, ...format}};
  if (value !== undefined && value !== null && value !== '') {
    cell.userEnteredValue = typeof value === 'number' ? {numberValue: value} : {stringValue: String(value)};
    cell.formattedValue = String(value);
  }
  return cell;
}

function fixtureFormula(formula, value) {
  return {
    userEnteredValue: {formulaValue: formula},
    effectiveValue: {numberValue: value},
    formattedValue: String(value),
    userEnteredFormat: {textFormat: {fontFamily: 'Calibri', fontSize: 11}},
  };
}

function fixtureSnapshot() {
  const solid = {style: 'SOLID', color: {red: 0, green: 0, blue: 0}};
  const borderFormat = {borders: {top: solid, bottom: solid, left: solid, right: solid}, verticalAlignment: 'MIDDLE'};
  const row = values => ({values});
  const beforeRows = [
    row([fixtureCell('FORNECEDOR ABC')]),
    row([fixtureCell('Padronizada em 15/10/2026, 07:24')]),
    row([]),
    row([fixtureCell('LUCAS'), fixtureCell(''), fixtureCell(''), fixtureCell(''), fixtureCell(''), fixtureCell('MCR ROD')]),
    row([fixtureCell(46308, {numberFormat: {type: 'DATE', pattern: 'dd/mm/yyyy'}})]),
    row([fixtureCell(''), fixtureCell(''), fixtureCell(''), fixtureCell(''), fixtureCell(''), fixtureCell(''), fixtureCell('0'), fixtureCell('0')]),
    row(['VENDA', 'COMPRA', 'DESCRIÇÃO', 'ESTOQUE', 'UN', 'MAR26', 'ABR26'].map(value => fixtureCell(value))),
    row([fixtureCell('00123'), fixtureCell('C-01'), fixtureCell('Produto um'), fixtureCell(1.25, {numberFormat: {type: 'NUMBER', pattern: '0.00'}}), fixtureCell('UN'), fixtureCell('março 1'), fixtureCell('')]),
    row([fixtureCell('00456'), fixtureCell('C-02'), fixtureCell('Produto dois'), fixtureCell(2, {numberFormat: {type: 'NUMBER', pattern: '0'}}), fixtureCell('UN'), fixtureCell('março 2'), fixtureCell('abril 2')]),
  ];
  beforeRows[7].values[0] = fixtureCell('00123', {numberFormat: {type: 'TEXT', pattern: '@'}});
  beforeRows[8].values[0] = fixtureCell('00456', {numberFormat: {type: 'TEXT', pattern: '@'}});
  beforeRows[7].values[5].dataValidation = {condition: {type: 'ONE_OF_LIST'}};

  const metadata = Array.from({length: 8}, (_, index) => fixtureCell('', {
    textFormat: {fontFamily: 'Calibri', fontSize: 11, bold: index < 6},
  }));
  metadata[0] = fixtureCell('FORNECEDOR ABC', {textFormat: {fontFamily: 'Calibri', fontSize: 11, bold: true}});
  const topRows = [
    row([metadata[0], ...metadata.slice(1)]),
    row([fixtureCell('Padronizada em 15/10/2026, 07:24', {wrapStrategy: 'OVERFLOW_CELL'}), ...Array.from({length: 7}, () => fixtureCell(''))]),
    row([fixtureCell('Rotativo atualizado em 15/10/2026, 07:24', {wrapStrategy: 'OVERFLOW_CELL'}), ...Array.from({length: 7}, () => fixtureCell(''))]),
    row([fixtureCell('LUCAS'), fixtureCell(''), fixtureCell(''), fixtureCell(''), fixtureCell(''), fixtureCell(''), fixtureCell('MCR ROD'), fixtureCell('')]),
    row([fixtureCell(46308, {numberFormat: {type: 'DATE', pattern: 'dd/mm/yyyy'}}), ...Array.from({length: 7}, () => fixtureCell(''))]),
    row([fixtureCell(''), fixtureCell(''), fixtureCell(''), fixtureCell(''), fixtureCell(''), fixtureCell(''), fixtureFormula('=COUNTA(G8:G1000)', 2), fixtureFormula('=COUNTA(H8:H1000)', 1)]),
  ];
  const headerValues = ['VENDA', 'COMPRA', 'DESCRIÇÃO', 'EMB', 'ESTOQUE', 'UN', 'MAR26', 'ABR26'];
  const header = row(headerValues.map((value, columnIndex) => fixtureCell(value, {
    ...borderFormat,
    backgroundColor: {red: 0.07450981, green: 0.011764706, blue: 0.5529412},
    horizontalAlignment: columnIndex === 2 ? 'LEFT' : 'CENTER',
    textFormat: {fontFamily: 'Calibri', fontSize: 11, bold: true},
  })));
  const outputProducts = [
    ['00123', 'C-01', 'Produto um', '', 1.25, 'UN', 'março 1', ''],
    ['00456', 'C-02', 'Produto dois', '', 2, 'UN', 'março 2', 'abril 2'],
  ].map((values, rowIndex) => row(values.map((value, columnIndex) => fixtureCell(value, {
    ...borderFormat,
    horizontalAlignment: columnIndex === 2 ? 'LEFT' : 'CENTER',
    ...(columnIndex === 0 ? {numberFormat: {type: 'TEXT', pattern: '@'}} : {}),
    ...(columnIndex === 4 ? {numberFormat: {type: 'NUMBER', pattern: rowIndex ? '0' : '0.00'}} : {}),
  }))));
  outputProducts[0].values[6].dataValidation = {condition: {type: 'ONE_OF_LIST'}};
  const outputRows = [...topRows, header, ...outputProducts];
  const sourceSheet = {
    properties: {title: 'MODELO', gridProperties: {rowCount: 1000, columnCount: 40, frozenRowCount: 0}},
    data: [{rowData: beforeRows}],
    basicFilter: {range: {startRowIndex: 6, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 7}},
    filterViews: [{filterViewId: 1}],
    conditionalFormats: [{ranges: [{startRowIndex: 6}]}],
    bandedRanges: [{bandedRangeId: 1}],
  };
  const targetSheet = {
    properties: {title: 'MODELO', gridProperties: {rowCount: 1000, columnCount: 40, frozenRowCount: 7}},
    data: [{
      rowData: outputRows,
      rowMetadata: Array.from({length: 1000}, () => ({pixelSize: 17})),
      columnMetadata: Array.from({length: 8}, (_, index) => ({pixelSize: index === 2 ? 81 : 143})),
    }],
    basicFilter: {range: {startRowIndex: 6, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 8}},
    filterViews: [{filterViewId: 1}],
    conditionalFormats: [{ranges: [{startRowIndex: 6}]}],
    bandedRanges: [{bandedRangeId: 1}],
  };
  const before = {targetSheet: 'MODELO', sheets: [sourceSheet], otherSheets: []};
  const after = {targetSheet: 'MODELO', sheets: [targetSheet], otherSheets: [], expansionTest: {passed: true}};
  const second = JSON.parse(JSON.stringify(after));
  return {before, after, second};
}

let before;
let after;
let second;
if (process.argv[2] === '--fixtures') {
  ({before, after, second} = fixtureSnapshot());
} else {
  const [beforePath, afterPath, secondPath] = process.argv.slice(2);
  if (!secondPath) throw new Error('Informe snapshots antes, depois e da segunda execução, ou use --fixtures.');
  [before, after, second] = [beforePath, afterPath, secondPath].map(path => JSON.parse(fs.readFileSync(path, 'utf8')));
}

const failed = validate(before, after, second);
process.exitCode = failed ? 1 : 0;
