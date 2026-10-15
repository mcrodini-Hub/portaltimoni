// node scripts/validate-rotativo.mjs before.json after.json second.json
// Snapshots are Google Sheets CellData resources; use grid rows and dimension metadata.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const [beforePath, afterPath, secondPath] = process.argv.slice(2);
if (!secondPath) throw new Error('Informe snapshots antes, depois e da segunda execução.');
const [before, after, second] = [beforePath, afterPath, secondPath].map(p => JSON.parse(fs.readFileSync(p, 'utf8')));
const sheet = doc => doc.sheets.find(s => s.properties.title === (doc.targetSheet || 'pagina 1'));
const rows = s => s.data[0].rowData.map(r => r.values || []);
const a = rows(sheet(before)), b = rows(sheet(after)), c = rows(sheet(second));
const raw = x => x?.userEnteredValue || {};
const displayed = x => x?.formattedValue || '';
const nf = x => x?.userEnteredFormat?.numberFormat || {};
const norm = v => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const sourceHeader = a.findIndex(r => r.some(x => norm(displayed(x)) === 'estoque'));
const sourceNames = a[sourceHeader].map(x => norm(displayed(x)));
const alias = [['venda','codigo'],['compra'],['descricao'],['estoque'],['un','unidade']];
const core = alias.map(names => sourceNames.findIndex(n => names.includes(n)));
const excluded = sourceNames.map((n,i) => ['item','max','min','maximo','minimo'].includes(n) ? i : -1).filter(i => i >= 0);
let width = Math.max(...a.slice(sourceHeader).map(r => { let n=r.length; while(n && !Object.keys(raw(r[n-1])).length)n--; return n; }));
const histories = Array.from({length:width},(_,i)=>i).filter(i=>!core.includes(i)&&!excluded.includes(i));
const mapping = [...core,...histories];
const products = r => r.slice(7).filter(row => row.some(x=>Object.keys(raw(x)).length));
const dataEnd = 7 + products(b).length, lastColumn = mapping.length;
let failed = 0;
function check(name, run) {try {run(); console.log(`APROVADO | ${name}`);}catch(e){failed++;console.log(`REPROVADO | ${name}: ${e.message}`);}}
check('1. Quantidade e ordem dos produtos',()=>{
  const source = a.slice(sourceHeader+1).filter(r=>r.some(x=>Object.keys(raw(x)).length));
  assert.equal(source.length,products(b).length);
  assert.deepEqual(source.map(r=>raw(r[core[2]])),products(b).map(r=>raw(r[2])));
});
check('2. Códigos e zeros à esquerda',()=>{
  for(let r=sourceHeader+1;r<a.length;r++)for(let col=0;col<2;col++)if(core[col]>=0){assert.deepEqual(raw(a[r][core[col]]),raw(b[r+6-sourceHeader]?.[col]));assert.equal(displayed(a[r][core[col]]),displayed(b[r+6-sourceHeader]?.[col]));}
});
check('3. Valores brutos e exibidos',()=>{
  for(let r=sourceHeader+1;r<a.length;r++)for(let col=0;col<mapping.length;col++)if(mapping[col]>=0){assert.deepEqual(raw(a[r][mapping[col]]),raw(b[r+6-sourceHeader]?.[col]));assert.equal(displayed(a[r][mapping[col]]),displayed(b[r+6-sourceHeader]?.[col]));}
});
check('4. Fórmulas existentes',()=>{
  for(let r=sourceHeader+1;r<a.length;r++)for(let col=0;col<mapping.length;col++)if(raw(a[r][mapping[col]]).formulaValue){assert.equal(raw(b[r+6-sourceHeader]?.[col]).formulaValue,raw(a[r][mapping[col]]).formulaValue);assert.ok(!b[r+6-sourceHeader][col].effectiveValue?.errorValue);}
});
check('5. Históricos e formatos de data/número',()=>{
  for(let r=sourceHeader;r<a.length;r++)for(let col=5;col<mapping.length;col++){assert.deepEqual(raw(a[r][mapping[col]]),raw(b[r+6-sourceHeader]?.[col]));assert.deepEqual(nf(a[r][mapping[col]]),nf(b[r+6-sourceHeader]?.[col]));assert.equal(displayed(a[r][mapping[col]]),displayed(b[r+6-sourceHeader]?.[col]));}
});
check('6. Cabeçalho e início dos produtos',()=>assert.deepEqual(b[6].slice(0,5).map(displayed),['VENDA','COMPRA','DESCRIÇÃO','ESTOQUE','UN']));
check('7. Bordas sólidas em todo o intervalo',()=>{for(let r=6;r<dataEnd;r++)for(let col=0;col<lastColumn;col++)for(const edge of ['top','bottom','left','right'])assert.equal(b[r][col].userEnteredFormat?.borders?.[edge]?.style,'SOLID');});
check('8. Alinhamentos',()=>{for(let r=6;r<dataEnd;r++)for(let col=0;col<lastColumn;col++){assert.equal(b[r][col].userEnteredFormat.horizontalAlignment,col===2?'LEFT':'CENTER');assert.equal(b[r][col].userEnteredFormat.verticalAlignment,'MIDDLE');}});
check('9. Fontes, topo e dimensões',()=>{
  assert.equal(b[0][0].userEnteredFormat.textFormat.fontSize,16);
  for(let r=6;r<dataEnd;r++)for(let col=0;col<lastColumn;col++)assert.equal(b[r][col].userEnteredFormat.textFormat.fontFamily,'Calibri');
  assert.deepEqual(raw(a[1]?.[0]).stringValue?.startsWith('Padronizada em ') ? raw(a[1][0]) : raw(b[1][0]),raw(b[1][0]));
  const meta=sheet(after).data[0];
  assert.ok(meta.columnMetadata?.length>=lastColumn,'Inclua columnMetadata no snapshot');
  [160,160,439,103,31].forEach((px,i)=>assert.equal(meta.columnMetadata[i].pixelSize,px));
  for(let i=5;i<lastColumn;i++)assert.equal(meta.columnMetadata[i].pixelSize,127);
  assert.equal(meta.rowMetadata[0].pixelSize,32);assert.equal(meta.rowMetadata[6].pixelSize,29);
});
check('10. Limpeza e outras abas',()=>{
  const s=sheet(after);assert.equal(s.conditionalFormats?.length||0,0);assert.equal(s.merges?.length||0,0);assert.equal(s.filterViews?.length||0,0);assert.equal(s.bandedRanges?.length||0,0);assert.ok(!s.basicFilter);
  assert.equal(s.properties.gridProperties.frozenRowCount,7);
  for(const row of b)for(const cell of row)assert.ok(!cell.dataValidation);
  assert.deepEqual(before.otherSheets,after.otherSheets,'Inclua snapshots das outras abas');assert.ok(before.otherSheets);
});
check('11. Contadores abertos e expansão',()=>{
  for(let col=5;col<lastColumn;col++){assert.match(raw(b[5][col]).formulaValue,/^=COUNTA\([A-Z]+8:[A-Z]+\)$/);assert.ok(!b[5][col].effectiveValue?.errorValue);const expected=b.slice(7).filter(r=>Object.keys(raw(r[col])).length>0).length;assert.equal(b[5][col].effectiveValue.numberValue,expected);}
  assert.equal(after.expansionTest?.passed,true,'Teste de expansão ausente');
});
check('12. Segunda execução idempotente',()=>{assert.deepEqual(b,c);assert.deepEqual(sheet(after).properties.gridProperties,sheet(second).properties.gridProperties);});
process.exitCode=failed?1:0;
