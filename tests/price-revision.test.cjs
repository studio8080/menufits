const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('function parseRevisionPrice('),html.indexOf('function downloadRevisionBackup('));
const model=vm.createContext({plain:value=>String(value||'').replace(/<[^>]*>/g,''),Intl});
vm.runInContext(source,model);
const doc={cur:'pre',categories:[{id:'food',title:'Food',items:[{id:'a',name:'A',price:'1,200'},{id:'b',name:'B',price:'時価'}]},{id:'drink',title:'Drinks',items:[{id:'c',name:'C',price:'12.50'}]}]};
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
test('category labels read the title field used by real menu samples',()=>{
  const rows=model.revisionRows(doc,options);
  assert.equal(rows[0].category,'Food');assert.equal(rows[2].category,'Drinks');
  assert.match(html,/escHTML\(plain\(c\.title\|\|c\.name\)\)/);
});
test('invalid inputs fail closed and negative prices require explicit exclusion',()=>{
  for(const change of [{amount:''},{amount:NaN},{step:0},{round:'unknown'},{mode:'percent',amount:-101}])assert.throws(()=>model.revisionRows(doc,{...options,...change}));
  assert.equal(model.revisionRows(doc,{...options,amount:-1500})[0].invalid,true);
  assert.equal(model.revisionRows(doc,{...options,amount:-1500},new Set(['0:0']))[0].selected,false);
});

// Exercise the real preview/apply/restore handlers with in-memory storage only.
function transactionFixture({stored,failWrite,failRead=false,failRemove=false}={}){
  const current={cur:'pre',categories:[{id:'food',title:'Food',items:[{id:'a',name:'A',price:'110',desc:'Before'}]}]};
  const previous={version:1,currency:'pre',state:{...current,categories:[{id:'food',title:'Food',items:[{id:'a',name:'A',price:'100',desc:'Before'}]}]},
    changes:[{categoryId:'food',itemId:'a',before:'100',after:'110'}]};
  const backupKey='menu-test:price-revision-backup-v1';
  const store=new Map(stored||[['menu-test',JSON.stringify(current)],[backupKey,JSON.stringify(previous)]]);
  const messages=[],nodes=new Map();let writes=0;
  const values={'#revisionCategory':'all','#revisionMode':'fixed','#revisionAmount':'10','#revisionStep':'1','#revisionRound':'round'};
  const node=key=>{if(!nodes.has(key))nodes.set(key,{value:values[key]||'',hidden:false,disabled:false,focus(){},setAttribute(){},classList:{remove(){}}});return nodes.get(key);};
  const runtime=vm.createContext({KEY:'menu-test',state:JSON.parse(store.get('menu-test')),plain:value=>String(value??'').replace(/<[^>]*>/g,''),Intl,
    T:a=>a,proGate:()=>false,flushCommit(){},openModal(){},save(){},render(){},toast:message=>messages.push(message),
    $:node,$$:()=>[],modal:{setAttribute(){},scrollTop:0},mask:{classList:{remove(){}}},
    escHTML:value=>String(value),localStorage:{
      getItem(key){if(failRead)throw Error('Read blocked');return store.get(key)??null;},
      setItem(key,value){writes++;if(failWrite?.(key,value,writes))throw Error('Quota blocked');store.set(key,String(value));},
      removeItem(key){if(failRemove)throw Error('Remove blocked');store.delete(key);}
    }});
  vm.runInContext(html.slice(html.indexOf('const PRICE_BACKUP_KEY='),html.indexOf("$('#priceRevisionBtn').onclick=")),runtime);
  return {runtime,store,backupKey,previous,messages,node,apply(){vm.runInContext('openPriceRevision()',runtime);node('#revisionApply').onclick();},
    run:source=>vm.runInContext(source,runtime),setFailure(fn){failWrite=fn;}};
}

test('failed second document save preserves the previous successful revision backup and undo',()=>{
  const f=transactionFixture({failWrite:key=>key==='menu-test'}),before=f.store.get('menu-test'),backup=f.store.get(f.backupKey);
  f.apply();
  assert.equal(f.store.get('menu-test'),before);
  assert.equal(f.runtime.state.categories[0].items[0].price,'110');
  assert.equal(f.store.get(f.backupKey),backup);
  f.setFailure(null);f.run('restorePriceRevision()');
  assert.equal(f.runtime.state.categories[0].items[0].price,'100');
});

test('failed document save removes an attempted backup when no earlier revision exists',()=>{
  const f=transactionFixture({stored:[['menu-test',JSON.stringify({cur:'pre',categories:[{id:'food',items:[{id:'a',name:'A',price:'110'}]}]})]],failWrite:key=>key==='menu-test'});
  f.apply();assert.equal(f.store.has(f.backupKey),false);assert.equal(f.run('readPriceBackup()'),null);
  assert.equal(f.node('#priceRestoreBtn').hidden,true);assert.equal(f.node('#priceBackupBtn').hidden,true);
});

test('a failed backup write leaves the saved menu and earlier backup intact',()=>{
  const f=transactionFixture({failWrite:(key,value)=>key.endsWith(':price-revision-backup-v1')&&JSON.parse(value).changes[0].after==='120'});
  const before=[...f.store];f.apply();assert.deepEqual([...f.store],before);assert.equal(f.runtime.state.categories[0].items[0].price,'110');
});

test('rollback storage failure blocks undo and keeps the earlier backup available in memory',()=>{
  const f=transactionFixture({failWrite:(key,value)=>key==='menu-test'||(key.endsWith(':price-revision-backup-v1')&&JSON.parse(value).changes[0].after==='110')});
  f.apply();assert.equal(f.runtime.state.categories[0].items[0].price,'110');assert.equal(f.node('#priceRestoreBtn').hidden,true);
  assert.equal(JSON.parse(f.run('JSON.stringify(readPriceBackup())')).state.categories[0].items[0].price,'100');
  f.run('restorePriceRevision()');assert.equal(f.runtime.state.categories[0].items[0].price,'110');
  assert.match(f.node('#revisionStatus').textContent,/取消/);
  const reloaded=transactionFixture({stored:[...f.store]});
  assert.equal(reloaded.run('canRestorePriceRevision(readPriceBackup())'),false);
  f.setFailure(null);f.apply();assert.equal(f.runtime.state.categories[0].items[0].price,'120');
  assert.equal(f.run('canRestorePriceRevision(readPriceBackup())'),true);
});

test('rollback remove failure without an older backup never offers undo',()=>{
  const current={cur:'pre',categories:[{id:'food',items:[{id:'a',name:'A',price:'110'}]}]};
  const f=transactionFixture({stored:[['menu-test',JSON.stringify(current)]],failWrite:key=>key==='menu-test',failRemove:true});
  f.apply();assert.equal(f.run('readPriceBackup()'),null);assert.equal(f.node('#priceRestoreBtn').hidden,true);
  assert.equal(f.node('#priceBackupBtn').hidden,true);assert.equal(f.runtime.state.categories[0].items[0].price,'110');
});

test('storage read failure aborts before replacing an earlier backup',()=>{
  const f=transactionFixture({failRead:true}),before=[...f.store];f.apply();assert.deepEqual([...f.store],before);
  assert.equal(f.runtime.state.categories[0].items[0].price,'110');assert.equal(f.node('#priceRestoreBtn').hidden,true);
});

test('successful apply and targeted undo retain later description edits',()=>{
  const f=transactionFixture();f.apply();assert.equal(f.runtime.state.categories[0].items[0].price,'120');
  assert.equal(f.run('readPriceBackup().state.categories[0].items[0].price'),'110');
  f.runtime.state.categories[0].items[0].desc='Later edit';f.run('restorePriceRevision()');
  assert.equal(f.runtime.state.categories[0].items[0].price,'110');assert.equal(f.runtime.state.categories[0].items[0].desc,'Later edit');
});

test('malformed saved backup entries cannot crash startup controls or offer undo',()=>{
  const current={cur:'pre',categories:[{id:'food',items:[{id:'a',price:'110'}]}]};
  for(const backup of ['broken JSON','null','{"currency":"pre","changes":[null]}','{"currency":"pre","changes":[{}]}']){
    const f=transactionFixture({stored:[['menu-test',JSON.stringify(current)],['menu-test:price-revision-backup-v1',backup]]});
    assert.doesNotThrow(()=>f.run('refreshPriceBackupControls()'));
    assert.equal(f.node('#priceRestoreBtn').hidden,true);
  }
});
