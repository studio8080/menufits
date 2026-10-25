const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('function parseRevisionPrice('),html.indexOf('function downloadRevisionBackup('));
const model=vm.createContext({plain:value=>String(value||'').replace(/<[^>]*>/g,''),Intl});
vm.runInContext(source,model);
const doc={cur:'pre',categories:[{id:'food',name:'Food',items:[{id:'a',name:'A',price:'1,200'},{id:'b',name:'B',price:'時価'}]},{id:'drink',name:'Drinks',items:[{id:'c',name:'C',price:'12.50'}]}]};
const options={category:'all',mode:'fixed',amount:25,step:1,round:'round'};
test('strict price parsing does not guess labels, ranges or currency symbols',()=>{
  for(const value of ['時価','','100〜200','¥100','100円','1,20','1e3','-5','Infinity'])assert.equal(model.parseRevisionPrice(value,'pre'),null);
  assert.equal(model.parseRevisionPrice('1,200.50','dol'),1200.5);
  assert.equal(model.parseRevisionPrice('1.200,50','eurs'),1200.5);
});
test('fixed, percent and all rounding modes use the current document currency',()=>{
  assert.equal(model.revisionRows(doc,options)[0].after,'1,225');
  assert.equal(model.revisionRows(doc,{...options,mode:'percent',amount:10,step:10})[0].after,'1,320');
  assert.equal(model.revisionRows(doc,{...options,amount:1,step:10,round:'ceil'})[0].after,'1,210');
  assert.equal(model.revisionRows(doc,{...options,amount:1,step:10,round:'floor'})[0].after,'1,200');
  assert.equal(model.revisionRows(doc,{...options,amount:.05,step:.01})[2].after,'12.55');
});
test('category scope and exclusions are independent and never mutate the document',()=>{
  const before=JSON.stringify(doc);
  assert.equal(model.revisionRows(doc,{...options,category:'drink'}).length,1);
  const rows=model.revisionRows(doc,options,new Set(['0:0']));
  assert.equal(rows[0].selected,false);assert.equal(rows[1].review,true);assert.equal(rows[1].selected,false);
  assert.equal(JSON.stringify(doc),before);
});
test('invalid inputs fail closed and negative prices require explicit exclusion',()=>{
  for(const change of [{amount:''},{amount:NaN},{step:0},{round:'unknown'},{mode:'percent',amount:-101}])assert.throws(()=>model.revisionRows(doc,{...options,...change}));
  assert.equal(model.revisionRows(doc,{...options,amount:-1500})[0].invalid,true);
  assert.equal(model.revisionRows(doc,{...options,amount:-1500},new Set(['0:0']))[0].selected,false);
});
