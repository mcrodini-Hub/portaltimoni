import test from 'node:test';
import assert from 'node:assert/strict';
import {planOfficialRotativoModel,applyOfficialRotativoModel,ROTATIVO_MODEL_SPREADSHEET_ID} from '../lib/rotativo-official-model.ts';
const cell = v => ({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:v},formattedValue:String(v)});
const fixture = () => ({properties:{sheetId:1,title:'Produtos',gridProperties:{rowCount:1000,columnCount:40}},data:[{rowData:[...Array.from({length:6},()=>({values:[]})),{values:['VENDA','COMPRA','DESCRIÇÃO','ESTOQUE','UN','MAR26'].map(cell)},{values:['00123','01/02','Produto',1.25,'UN','texto'].map(cell)}]}]});
test('modelo oficial não insere, move, ordena ou regrava produtos',()=>{const p=planOfficialRotativoModel(fixture(),'Fornecedor');assert.equal(p.official,true);assert.equal(p.lastRow,8);assert.equal(p.lastColumn,6);assert.ok(!p.requests.some(r=>r.insertDimension||r.moveDimension||r.sortRange||r.deleteDimension));assert.ok(!p.requests.some(r=>r.updateCells?.start.rowIndex>=7));});
test('históricos além de AE e produtos após linha 40 entram no intervalo',()=>{const f=fixture();f.data[0].rowData[6].values[35]=cell('OUT26');f.data[0].rowData[50]={values:[cell('99'),cell(''),cell('Produto final'),cell(5)]};const p=planOfficialRotativoModel(f,'Fornecedor');assert.equal(p.lastColumn,36);assert.equal(p.lastRow,51);});
test('código numérico com zeros de formato bloqueia sem converter',()=>{const f=fixture();f.data[0].rowData[7].values[0]={userEnteredValue:{numberValue:123},formattedValue:'00123',userEnteredFormat:{numberFormat:{type:'NUMBER',pattern:'00000'}}};assert.throws(()=>planOfficialRotativoModel(f,'F'),/Código com formato especial/);});
test('cabeçalhos ambíguos e desconhecidos são rejeitados',()=>{const f=fixture();f.data[0].rowData[8]={values:['VENDA','COMPRA','DESCRIÇÃO','ESTOQUE','UN'].map(cell)};assert.throws(()=>planOfficialRotativoModel(f,'F'),/ambíguo/);assert.throws(()=>planOfficialRotativoModel({properties:f.properties,data:[]},'F'),/desconhecido/);});
test('limpeza preserva numberFormat dos históricos e bordas ficam limitadas',()=>{const p=planOfficialRotativoModel(fixture(),'F');for(const r of p.requests){if(r.repeatCell?.fields.includes('numberFormat'))assert.ok(r.repeatCell.range.startColumnIndex<5);if(r.updateBorders)assert.ok(r.updateBorders.range.endColumnIndex<=p.lastColumn);}const b=p.requests.find(r=>r.updateBorders?.range.startRowIndex===6).updateBorders;assert.equal(b.innerVertical.style,'SOLID');assert.equal(b.range.endRowIndex,8);});
test('regras condicionais são removidas de trás para frente',()=>{const f=fixture();f.conditionalFormats=[{},{},{}];assert.deepEqual(planOfficialRotativoModel(f,'F').requests.filter(r=>r.deleteConditionalFormatRule).map(r=>r.deleteConditionalFormatRule.index),[2,1,0]);});
test('modelo antigo usa movimentos nativos e mantém ordem de linhas',()=>{const f=fixture();f.data[0].rowData=[{values:[]},{values:[]},{values:['ITEM','VENDA','COMPRA','DESCRICAO','MAX','ESTOQUE','UNIDADE','MAR26'].map(cell)},{values:[1,'00123','02','Produto',10,5,'UN',3].map(cell)}];const p=planOfficialRotativoModel(f,'F');assert.equal(p.rowShift,4);assert.deepEqual(p.histories,[7]);assert.equal(p.lastRow,8);assert.ok(p.requests.some(r=>r.moveDimension));assert.ok(!p.requests.some(r=>r.sortRange));});
test('BARIFLEX: aritmética literal, ITEM isolado, contadores sem cabeçalho e ordem',()=>{
  const f=fixture();
  f.data[0].rowData=[{values:[cell('BARIFLEX')]},{values:[]},{values:[]},{values:[]},{values:[cell('Funcionário:'),cell('LUCAS'),cell('Data:'),{userEnteredValue:{numberValue:46181},formattedValue:'08/06/26',userEnteredFormat:{numberFormat:{type:'DATE',pattern:'dd/mm/yy'}}},...Array.from({length:35},()=>cell(0))]},
    {values:['ITEM','CODIGO','DESCRICAO','min','max','ESTOQUE','UNIDADE',...Array.from({length:26},(_,i)=>`HIST${i}`)].map(cell)},
    {values:[cell(22),cell(12098),cell('Produto ESTOQUE 600MTS'),cell(''),cell(''),{userEnteredValue:{formulaValue:'=200*4'},effectiveValue:{numberValue:800},formattedValue:'800'},cell('M'),cell('PEDIR NO PROXIMO')]},
    {values:[cell(16),cell(1241),cell('Outro produto'),cell(''),cell(''),cell(0),cell('M')]},
    {values:[cell(23)]},{values:[cell(24)]},{values:[cell(25)]}];
  const p=planOfficialRotativoModel(f,'BARIFLEX');
  assert.equal(p.products,2);assert.equal(p.lastRow,9);assert.equal(p.lastColumn,31);assert.equal(p.histories.length,26);
  assert.ok(p.requests.filter(r=>r.updateBorders).every(r=>r.updateBorders.range.startRowIndex===6));
  assert.ok(!p.requests.some(r=>r.sortRange||r.updateCells?.start.rowIndex>=7));
  const writes=p.requests.filter(r=>r.updateCells).map(r=>r.updateCells);
  assert.deepEqual(writes.find(r=>r.start.rowIndex===4).rows[0].values[0].userEnteredValue,{numberValue:46181});
  f.data[0].rowData[6].values[5].userEnteredValue.formulaValue='=D7+E7';
  assert.throws(()=>planOfficialRotativoModel(f,'F'),/fórmulas/);
});
test('cabeçalho centralizado, descrição dos dados à esquerda e bordas só na tabela',()=>{
  const p=planOfficialRotativoModel(fixture(),'F');
  assert.ok(p.requests.filter(r=>r.updateBorders).every(r=>r.updateBorders.range.startRowIndex===6));
  const left=p.requests.filter(r=>r.repeatCell?.cell.userEnteredFormat?.horizontalAlignment==='LEFT'&&r.repeatCell.range.startColumnIndex===2);
  assert.equal(left.length,1);assert.equal(left[0].repeatCell.range.startRowIndex,7);
  assert.ok(p.requests.some(r=>r.repeatCell?.fields==='userEnteredFormat'&&r.repeatCell.range.startRowIndex===p.lastRow));
});
test('estilos e dimensões vêm do MODELO sem copiar seus números e textos',()=>{
  const model=fixture();
  for(let r=0;r<8;r++)for(let c=0;c<6;c++){
    const row=model.data[0].rowData[r];row.values[c] ||= cell('');
    row.values[c].effectiveFormat={textFormat:{fontFamily:'Calibri',fontSize:r===1?10:11,bold:false},backgroundColor:{red:1,green:1,blue:1}};
  }
  model.data[0].columnMetadata=Array.from({length:6},(_,i)=>({pixelSize:100+i}));
  model.data[0].rowMetadata=Array.from({length:8},(_,i)=>({pixelSize:20+i}));
  const p=planOfficialRotativoModel(fixture(),'F',new Date(),model);
  assert.ok(p.requests.some(r=>r.repeatCell?.range.startRowIndex===1&&r.repeatCell.cell.userEnteredFormat?.textFormat?.fontSize===10));
  assert.ok(p.requests.some(r=>r.updateDimensionProperties?.range.dimension==='COLUMNS'&&r.updateDimensionProperties.range.startIndex===5&&r.updateDimensionProperties.properties.pixelSize===105));
  assert.ok(!p.requests.some(r=>r.updateCells?.start.rowIndex>=7));
  model.data[0].rowData[6].values[0]=cell('OUTRO');
  assert.throws(()=>planOfficialRotativoModel(fixture(),'F',new Date(),model),/MODELO/);
});
test('planilha de referência nunca pode ser padronizada',async()=>{
  await assert.rejects(applyOfficialRotativoModel({},ROTATIVO_MODEL_SPREADSHEET_ID,'MODELO'),/somente referência/);
});

