// node scripts/validate-rotativo.mjs before.json after.json second.json [--bariflex]
// Google Sheets resources with CellData, dimensions and all backup sheets.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const [beforePath, afterPath, secondPath, mode] = process.argv.slice(2);
if (!secondPath) throw new Error('Informe snapshots antes, depois e da segunda execução.');
const [before, after, second] = [beforePath, afterPath, secondPath].map(p => JSON.parse(fs.readFileSync(p, 'utf8')));
const target = before.targetSheet;
assert.ok(target, 'Informe targetSheet no snapshot.');
const sheet = doc => { const s = doc.sheets.find(s => s.properties.title === target); assert.ok(s, 'Aba alvo ausente'); return s; };
const rows = s => { const out=[]; for(const d of s.data||[]) for(const [i,r] of (d.rowData||[]).entries()) { const row=out[i+(d.startRow||0)] ||= []; for(const [j,c] of (r.values||[]).entries()) row[j+(d.startColumn||0)]=c; } return out; };
const raw = c => c?.userEnteredValue || {};
const text = c => c?.formattedValue ?? raw(c).stringValue ?? '';
const occupied = c => Object.values(raw(c)).some(v=>v!=='' && v!=null);
const norm = v => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const a=rows(sheet(before)), b=rows(sheet(after));
const headers = a.map((r,i)=>({i,n:r.map(x=>norm(text(x)))})).filter(({n})=>n.includes('estoque')&&n.includes('descricao'));
assert.equal(headers.length,1,'Cabeçalho de origem ambíguo');
const {i:header,n:names}=headers[0];
const aliases=[['venda','codigo'],['compra'],['descricao'],['estoque'],['un','unidade']];
const core=aliases.map(ns=>{for(const n of ns){const i=names.indexOf(n);if(i>=0)return i;}return -1;});
const excluded=['item','numero','min','minimo','max','maximo','estoque minimo','estoque maximo'];
const histories=names.map((n,i)=>n&&!core.includes(i)&&!excluded.includes(n)?i:-1).filter(i=>i>=0);
const source=a.slice(header+1).filter(r=>core.some(i=>i>=0&&occupied(r[i])));
const products=b.slice(7).filter(r=>r.slice(0,5).some(occupied));
const width=5+histories.length, end=7+products.length;
const identity=(r,idx)=>JSON.stringify([raw(r[idx[0]]),raw(r[idx[2]])]);
const sourceMap=new Map(source.map(r=>[identity(r,core),r]));
const targetMap=new Map(products.map(r=>[identity(r,[0,1,2,3,4]),r]));
const fmt=(r,col)=>b[r]?.[col]?.userEnteredFormat||{};
const letter=i=>{let s='';for(let n=i+1;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const eachCell=run=>{for(let r=0;r<b.length;r++)for(let col=0;col<(b[r]?.length||0);col++)run(b[r][col]||{},r,col);};
const eachTable=run=>{for(let r=6;r<end;r++)for(let col=0;col<width;col++)run(fmt(r,col),r,col);};
let failed=0;
function check(name,run){try{run();console.log(`APROVADO | ${name}`);}catch(e){failed++;console.log(`REPROVADO | ${name}: ${e.message}`);}}
check('1. Valores dos produtos idênticos por identidade e coluna',()=>{
  assert.equal(sourceMap.size,source.length,'Identidade duplicada na origem'); assert.equal(targetMap.size,products.length);
  assert.deepEqual([...targetMap.keys()],[...sourceMap.keys()],'Quantidade ou ordem alterada');
  for(const [id,r] of sourceMap) for(const col of [2,3,4]) assert.deepEqual(raw(targetMap.get(id)[col]),raw(r[core[col]]));
});
check('2. Históricos idênticos por produto e nome original',()=>{
  assert.deepEqual(b[6].slice(5,width).map(raw),histories.map(i=>raw(a[header][i])));
  for(const [id,r] of sourceMap)for(const [j,col] of histories.entries()){
    assert.deepEqual(raw(targetMap.get(id)?.[j+5]),raw(r[col]));
    assert.deepEqual(targetMap.get(id)?.[j+5]?.userEnteredFormat?.numberFormat||{},r[col]?.userEnteredFormat?.numberFormat||{});
  }
  if(mode==='--bariflex'){assert.equal(histories.length,26);assert.equal(width,31);assert.ok(source.some(r=>raw(r[names.indexOf('set25')]).stringValue==='PEDIR NO PROXIMO'));}
});
check('3. VENDA e COMPRA preservados',()=>{for(const [id,r] of sourceMap)for(const col of [0,1])assert.deepEqual(raw(targetMap.get(id)?.[col]),core[col]<0?{}:raw(r[core[col]]));});
check('4. Funcionário e data bruta preservados',()=>{
  let employee,date;
  if(header===6){employee=a[3]?.[0];date=a[4]?.[0];}else for(const row of a.slice(0,header)){
    const emp=row.findIndex(x=>norm(text(x)).includes('funcionario')),dt=row.findIndex(x=>norm(text(x))==='data');
    if(emp>=0)employee=row.slice(emp+1,dt>emp?dt:undefined).find(occupied)||employee;
    if(dt>=0)date=row.slice(dt+1).find(occupied)||date;
  }
  assert.ok(employee&&date,'Metadados originais ausentes');assert.deepEqual(raw(b[3][0]),raw(employee));assert.deepEqual(raw(b[4][0]),raw(date));
  assert.deepEqual(b[4][0].userEnteredFormat?.numberFormat,date.userEnteredFormat?.numberFormat);
  if(mode==='--bariflex'){assert.deepEqual(raw(b[3][0]),{stringValue:'LUCAS'});assert.deepEqual(raw(b[4][0]),{numberValue:46181});assert.equal(text(b[4][0]),'08/06/26');}
});
check('5. Condicionais, mesclagens, validação e faixas removidas',()=>{const s=sheet(after);for(const k of ['conditionalFormats','merges','bandedRanges'])assert.equal(s[k]?.length||0,0);eachCell(cell=>assert.ok(!cell.dataValidation));});
check('6. Sem bordas tracejadas',()=>eachCell(cell=>{for(const border of Object.values(cell.userEnteredFormat?.borders||{}))assert.ok(!['DASHED','DOTTED'].includes(border.style));}));
check('7. Sem Arial; dados Calibri 11',()=>{eachCell(cell=>assert.notEqual(cell.userEnteredFormat?.textFormat?.fontFamily?.toLowerCase(),'arial'));eachTable(f=>{assert.equal(f.textFormat.fontFamily,'Calibri');assert.equal(f.textFormat.fontSize,11);});});
check('8. Preenchimentos e bordas limitados ao intervalo aprovado',()=>{
  eachTable(f=>{for(const edge of ['top','bottom','left','right'])assert.equal(f.borders?.[edge]?.style,'SOLID');});
  eachCell((cell,r,col)=>{const f=cell.userEnteredFormat||{};if(r<6||r>=end||col>=width)assert.ok(!Object.values(f.borders||{}).some(v=>v.style&&v.style!=='NONE'),`Borda fora em ${letter(col)}${r+1}`);
    if(r>=7&&r<end&&col<width)assert.deepEqual(f.backgroundColor,{red:1,green:1,blue:1});
    if(r>=end||col>=width)assert.deepEqual(f,{},`Formatação fora em ${letter(col)}${r+1}`);
  });
});
check('9. Alinhamentos conforme cabeçalho e dados',()=>eachTable((f,r,col)=>{assert.equal(f.horizontalAlignment,r>=7&&col===2?'LEFT':'CENTER');assert.equal(f.verticalAlignment,'MIDDLE');}));
check('10. Azul termina exatamente no último histórico',()=>{
  assert.deepEqual(b[6].slice(0,5).map(text),['VENDA','COMPRA','DESCRIÇÃO','ESTOQUE','UN']);
  for(let col=0;col<width;col++){const f=fmt(6,col),bg=f.backgroundColor;assert.ok(Math.abs(bg.red-19/255)<1e-6&&Math.abs(bg.green-3/255)<1e-6&&Math.abs(bg.blue-141/255)<1e-6);assert.equal(f.textFormat.bold,true);assert.deepEqual(f.textFormat.foregroundColor,{red:1,green:1,blue:1});}
  for(let col=width;col<(b[6]?.length||0);col++)assert.ok(!fmt(6,col).backgroundColor);
});
check('11. Linha 6 somente com contadores abertos nos históricos',()=>{
  for(let col=0;col<Math.max(width,b[5].length);col++)if(col<5||col>=width)assert.ok(!occupied(b[5][col]));else{
    assert.equal(raw(b[5][col]).formulaValue,`=COUNTA(${letter(col)}8:${letter(col)})`);assert.ok(!b[5][col].effectiveValue?.errorValue);
    assert.equal(b[5][col].effectiveValue?.numberValue,b.slice(7).filter(r=>occupied(r[col])).length);
  }
});
const cleanIds=v=>Array.isArray(v)?v.map(cleanIds):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['sheetId','filterViewId','bandedRangeId'].includes(k)).map(([k,v])=>[k,cleanIds(v)])):v;
check('12. Backup original intacto e preservado na segunda execução',()=>{
  const backups=after.sheets.filter(s=>s.properties.title.startsWith('BKP_ROTATIVO_'));assert.ok(backups.length,'Backup ausente');
  const backup=backups.find(s=>s.properties.title===`BKP_ROTATIVO_${target}`);assert.ok(backup,'Backup da origem ausente');
  assert.deepEqual(rows(backup),a);for(const k of ['conditionalFormats','merges','bandedRanges','filterViews'])assert.deepEqual(cleanIds(backup[k]||[]),cleanIds(sheet(before)[k]||[]));
  for(const s of backups)assert.deepEqual(s,second.sheets.find(t=>t.properties.title===s.properties.title));
});
check('13. Segunda execução idêntica exceto carimbo A2',()=>{
  const x=structuredClone(sheet(after)),y=structuredClone(sheet(second));
  for(const s of [x,y])for(const d of s.data||[])if((d.startRow||0)<=1&&d.rowData?.[1-(d.startRow||0)]?.values?.[0]){const cell=d.rowData[1-(d.startRow||0)].values[0];delete cell.userEnteredValue;delete cell.formattedValue;delete cell.effectiveValue;}
  assert.deepEqual(x,y);
});
check('14. Nenhuma linha fantasma virou produto',()=>{
  if(mode==='--bariflex')assert.equal(products.length,22);
  for(let r=7;r<b.length;r++)if(!b[r]?.slice(0,5).some(occupied))assert.ok(!b[r]?.some(occupied),'Linha só com histórico sem produto');
  assert.equal(end,7+source.length);for(let r=end;r<b.length;r++)assert.ok(!b[r]?.some(occupied));
});
console.log(`RESULTADO | ${14-failed}/14 APROVADOS`);
process.exitCode=failed?1:0;
