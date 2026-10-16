import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOfficialRotativoModel,
  findExistingExecutionBackup,
  planOfficialRotativoModel,
  ROTATIVO_HEADERS,
} from '../lib/rotativo-official-model.ts';

const cell = (value, extra = {}) => ({
  userEnteredValue: typeof value === 'number' ? {numberValue: value} : {stringValue: value},
  formattedValue: String(value),
  ...extra,
});

function currentFixture({histories = ['MAR26', 'ABR26'], updated = 'Rotativo atualizado em 15/10/2026, 07:24'} = {}) {
  const rowData = Array.from({length: 8}, () => ({values: []}));
  rowData[0] = {values: [cell('FORNECEDOR ABC')]};
  rowData[1] = {values: [cell('Padronizada em 15/10/2026, 07:24')]};
  rowData[2] = {values: [cell(updated)]};
  rowData[3] = {values: [cell('LUCAS'), cell(''), cell(''), cell(''), cell(''), cell(''), cell('MCR ROD')]};
  rowData[4] = {values: [cell('13/10/2026', {userEnteredFormat: {numberFormat: {type: 'DATE', pattern: 'dd/mm/yyyy'}}})]};
  rowData[5] = {values: Array.from({length: 6}, () => cell(''))};
  rowData[6] = {values: [...ROTATIVO_HEADERS, ...histories].map(cell)};
  const product = ['00123', 'C-01', 'Produto exemplo', 'CX', 1.25, 'UN', ...histories.map((_, i) => i ? 'venda' : '')].map(cell);
  product[0] = cell('00123', {userEnteredFormat: {numberFormat: {type: 'TEXT', pattern: '@'}}});
  rowData[7] = {values: product};
  rowData[7].values[6] = cell('', {dataValidation: {condition: {type: 'ONE_OF_LIST', values: [{userEnteredValue: 'Manual'}]}}});
  return {
    properties: {sheetId: 1, title: 'Fornecedor ABC', gridProperties: {rowCount: 1000, columnCount: 40}},
    data: [{rowData}],
    basicFilter: {range: {sheetId: 1, startRowIndex: 6, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 8}},
    filterViews: [{filterViewId: 11, title: 'Filtro manual'}],
    conditionalFormats: [{ranges: [{sheetId: 1}]}],
    bandedRanges: [{bandedRangeId: 12, range: {sheetId: 1}}],
    merges: [],
  };
}

function legacyFixture() {
  const rowData = [
    {values: [cell('Fornecedor ABC')]},
    {values: [cell('Padronizada em 15/10/2026, 07:24')]},
    {values: ['ITEM', 'VENDA', 'COMPRA', 'DESCRIÇÃO', 'NÚMERO', 'MIN', 'MAX', 'ESTOQUE', 'UN', 'MAR26'].map(cell)},
    {values: [cell(1), cell('00123'), cell('C-01'), cell('Produto'), cell('99'), cell(2), cell(4), cell(1.25), cell('UN'), cell('histórico')]},
  ];
  return {properties: {sheetId: 2, title: 'Fornecedor ABC', gridProperties: {rowCount: 1000, columnCount: 40}}, data: [{rowData}]};
}

test('adota seis cabeçalhos, mantém históricos e conta a partir de G6', () => {
  const fixture = currentFixture();
  const plan = planOfficialRotativoModel(fixture, 'Fornecedor ABC', new Date('2026-10-16T12:00:00Z'));
  assert.deepEqual(ROTATIVO_HEADERS, ['VENDA', 'COMPRA', 'DESCRIÇÃO', 'EMB', 'ESTOQUE', 'UN']);
  assert.equal(plan.official, true);
  assert.equal(plan.lastRow, 8);
  assert.equal(plan.lastColumn, 8);
  assert.deepEqual(plan.histories, [6, 7]);
  assert.ok(!plan.requests.some(request => request.insertDimension || request.moveDimension || request.deleteDimension));

  const counters = plan.requests.filter(request => request.updateCells?.start.rowIndex === 5).map(request => request.updateCells);
  assert.deepEqual(counters.map(request => request.start.columnIndex), [6, 7]);
  assert.deepEqual(counters.map(request => request.rows[0].values[0].userEnteredValue.formulaValue), [
    '=COUNTA(G8:G1000)', '=COUNTA(H8:H1000)',
  ]);
  const clearMetadata = plan.requests.find(request => request.repeatCell?.fields === 'userEnteredValue');
  assert.deepEqual(clearMetadata.repeatCell.range, {sheetId: 1, startRowIndex: 0, endRowIndex: 6, startColumnIndex: 0, endColumnIndex: 6});
  assert.ok(!plan.requests.some(request => request.clearBasicFilter || request.deleteFilterView || request.deleteConditionalFormatRule || request.deleteBanding));
  assert.ok(!plan.requests.some(request => request.repeatCell?.fields?.includes('dataValidation')));
});

test('insere EMB e preenche a data de atualização quando A3 está vazio', () => {
  const fixture = currentFixture({histories: [], updated: ''});
  fixture.data[0].rowData[6].values = ['VENDA', 'COMPRA', 'DESCRIÇÃO', 'ESTOQUE', 'UN'].map(cell);
  fixture.data[0].rowData[7].values = ['00123', 'C-01', 'Produto exemplo', 1.25, 'UN'].map(cell);
  const plan = planOfficialRotativoModel(fixture, 'Fornecedor ABC', new Date('2026-10-16T12:00:00Z'));
  assert.equal(plan.official, false);
  assert.deepEqual(plan.columns, [0, 1, 2, -1, 3, 4]);
  assert.deepEqual(plan.histories, []);
  assert.equal(plan.lastColumn, 6);
  assert.ok(plan.requests.some(request => request.insertDimension?.range.dimension === 'COLUMNS' && request.insertDimension.range.startIndex === 3));
  assert.ok(!plan.requests.some(request => request.updateCells?.start.rowIndex === 5 && request.updateCells.start.columnIndex >= 6));
  const a3 = plan.requests.find(request => request.updateCells?.start.rowIndex === 2 && request.updateCells.start.columnIndex === 0);
  assert.deepEqual(a3.updateCells.rows[0].values[0].userEnteredValue, {stringValue: 'Rotativo atualizado em 16/10/2026, 09:00'});
});

test('remove ITEM, MIN e MAX, mantendo NÚMERO como coluna preservada', () => {
  const plan = planOfficialRotativoModel(legacyFixture(), 'Fornecedor ABC');
  assert.equal(plan.rowShift, 4);
  assert.deepEqual(plan.columns, [1, 2, 3, -1, 7, 8]);
  assert.deepEqual(plan.histories, [4, 9]);
  assert.equal(plan.lastColumn, 8);
  assert.equal(plan.lastRow, 8);
  assert.equal(plan.requests.filter(request => request.deleteDimension?.range.dimension === 'COLUMNS').length, 3);
  assert.ok(plan.requests.some(request => request.moveDimension));
});

test('dimensões seguem 18 de largura nativa, C autofit e 17 px nas linhas', () => {
  const plan = planOfficialRotativoModel(currentFixture(), 'Fornecedor ABC');
  const dimensions = plan.requests.filter(request => request.updateDimensionProperties).map(request => request.updateDimensionProperties);
  assert.ok(dimensions.some(item => item.range.dimension === 'COLUMNS' && item.range.startIndex === 0 && item.range.endIndex === 2 && item.properties.pixelSize === 143));
  assert.ok(dimensions.some(item => item.range.dimension === 'COLUMNS' && item.range.startIndex === 3 && item.range.endIndex === 8 && item.properties.pixelSize === 143));
  assert.ok(dimensions.some(item => item.range.dimension === 'ROWS' && item.range.startIndex === 0 && item.range.endIndex === 1000 && item.properties.pixelSize === 17));
  assert.ok(plan.requests.some(item => item.autoResizeDimensions?.dimensions.startIndex === 2 && item.autoResizeDimensions.dimensions.endIndex === 3));
});

test('preserva o primeiro BKP_EXEC e ignora BKP_ROTATIVO', () => {
  const first = {properties: {sheetId: 10, title: 'BKP_EXEC_a1b2c3d4_Fornecedor ABC', hidden: true}};
  const tabs = [
    {properties: {sheetId: 1, title: 'Fornecedor ABC'}},
    {properties: {sheetId: 9, title: 'BKP_ROTATIVO_Fornecedor ABC'}},
    first,
    {properties: {sheetId: 11, title: 'BKP_EXEC_e5f6a7b8_Outro fornecedor'}},
  ];
  assert.equal(findExistingExecutionBackup(tabs, 'Fornecedor ABC'), first);
  assert.equal(findExistingExecutionBackup(tabs.slice(0, 2), 'Fornecedor ABC'), undefined);
});

test('a segunda execução reutiliza o primeiro backup sem criar outro', async () => {
  const source = currentFixture();
  const tabs = [{properties: source.properties}];
  let duplicateCount = 0;
  const fakeSheets = {
    spreadsheets: {
      get: async params => {
        if (params.ranges) return {data: {properties: {title: 'Fornecedor ABC'}, sheets: [source]}};
        return {data: {properties: {title: 'Fornecedor ABC'}, sheets: tabs}};
      },
      values: {
        get: async () => ({data: {values: source.data[0].rowData.map(row => (row.values || []).map(item => item.formattedValue ?? item.userEnteredValue?.stringValue ?? item.userEnteredValue?.numberValue ?? ''))}}),
      },
      batchUpdate: async params => {
        const request = params.requestBody.requests[0];
        if (request.duplicateSheet) {
          duplicateCount++;
          const backup = {properties: {sheetId: 2, title: request.duplicateSheet.newSheetName, hidden: false}};
          tabs.push(backup);
          return {data: {replies: [{duplicateSheet: {properties: {sheetId: 2}}}]}};
        }
        if (request.updateSheetProperties?.properties.hidden === true) {
          tabs.find(tab => tab.properties.sheetId === request.updateSheetProperties.properties.sheetId).properties.hidden = true;
          return {data: {replies: [{}]}};
        }
        const error = new Error('Fixture interrompe a escrita após o backup.');
        error.response = {status: 400};
        throw error;
      },
    },
  };
  for (let run = 0; run < 2; run++) {
    await assert.rejects(() => applyOfficialRotativoModel(fakeSheets, 'spreadsheet-id', 'Fornecedor ABC'), /Padronização recusada/);
  }
  assert.equal(duplicateCount, 1);
  assert.equal(tabs.filter(tab => tab.properties.title.startsWith('BKP_EXEC_')).length, 1);
  assert.equal(tabs.find(tab => tab.properties.title.startsWith('BKP_EXEC_')).properties.hidden, true);
});

test('código numérico com zeros de formato bloqueia sem converter', () => {
  const fixture = currentFixture();
  fixture.data[0].rowData[7].values[0] = {
    userEnteredValue: {numberValue: 123},
    formattedValue: '00123',
    userEnteredFormat: {numberFormat: {type: 'NUMBER', pattern: '00000'}},
  };
  assert.throws(() => planOfficialRotativoModel(fixture, 'Fornecedor ABC'), /Código com formato especial/);
});

test('cabeçalhos ambíguos e desconhecidos são rejeitados', () => {
  const fixture = currentFixture();
  fixture.data[0].rowData[8] = {values: ROTATIVO_HEADERS.map(cell)};
  assert.throws(() => planOfficialRotativoModel(fixture, 'Fornecedor ABC'), /ambíguo/);
  assert.throws(() => planOfficialRotativoModel({...fixture, data: []}, 'Fornecedor ABC'), /desconhecido/);
});

test('fórmulas em colunas MIN/MAX bloqueiam uma exclusão perigosa', () => {
  const fixture = legacyFixture();
  fixture.data[0].rowData[3].values[5] = {userEnteredValue: {formulaValue: '=A1+1'}};
  assert.throws(() => planOfficialRotativoModel(fixture, 'Fornecedor ABC'), /fórmulas e colunas auxiliares/);
});
