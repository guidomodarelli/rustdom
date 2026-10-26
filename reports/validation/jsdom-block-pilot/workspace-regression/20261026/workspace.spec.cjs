'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createHash}=require('node:crypto');
const test=require('node:test');
const {prepareWorkspace}=require('./workspace.cjs');
const repository=process.env.RUSTDOM_WORKSPACE_QA_SOURCE;
assert.ok(repository,'Provide the real published native Git source checkout');
const source=require(path.join(repository,'reports/benchmarks/native-class-ownership/control-precision/pilot/capture/source.cjs'));
const io=require(path.join(repository,'reports/benchmarks/native-class-ownership/control-precision/pilot/capture/io.cjs'));
const origin=source.producer('capture');
assert.equal(origin.sourceCommit,'1078e4fd190276a116e6dc5e64c9fe32eca3e7e9');
assert.equal(origin.sourceChangesRaw,'');assert.deepEqual(origin.sourceGitErrors,[]);

function fresh(callback){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'rustdom-workspace-layout-'));
  try{return callback(root);}
  finally{
    assert.equal(path.dirname(fs.realpathSync(root)),fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('rustdom-workspace-layout-'));
    fs.rmSync(root,{recursive:true});
  }
}
test('prepares a real reviewed snapshot and then accepts the next input without recreating its directory',()=>fresh((root)=>{
  const workspace=prepareWorkspace(origin,root,source,io);
  assert.ok(fs.statSync(workspace.inputs).isDirectory()&&fs.statSync(workspace.workers).isDirectory());
  assert.deepEqual(Object.keys(workspace.snapshot).sort(),Object.keys(origin.files).sort());
  const packageFile=path.join(workspace.inputs,'packages.tar.xz');
  assert.equal(createHash('sha256').update(fs.readFileSync(packageFile)).digest('hex'),
    'fb06276a9fb0510360b4a0cf804699b2554303c3f80cf164fcd60f3f443aa72d');
  io.writeNewJSON(path.join(workspace.inputs,'layout-check.json'),{purpose:'filesystem regression only',DOMExecuted:false});
  assert.deepEqual(io.readJSON(path.join(workspace.inputs,'layout-check.json')),{purpose:'filesystem regression only',DOMExecuted:false});
  assert.deepEqual(io.readJSON(path.join(root,'method-snapshot.json')),workspace.snapshot);
  assert.equal(io.hashFile(path.join(root,'method-publication.json')),'f85ec2b26d1839f7130a7bee4e02e560f6497f4003c7c0b2cf3f8c140402f2c1');
}));
test('refuses an already initialized destination while preserving its existing input bytes',()=>fresh((root)=>{
  fs.mkdirSync(path.join(root,'inputs'));
  const existing=path.join(root,'inputs','preserve.bin');const bytes=Buffer.from([0,255,13,10,128]);
  fs.writeFileSync(existing,bytes,{flag:'wx'});
  assert.throws(()=>prepareWorkspace(origin,root,source,io),{code:'EEXIST'});
  assert.deepEqual(fs.readFileSync(existing),bytes);
  assert.equal(fs.existsSync(path.join(root,'method-snapshot.json')),false);
}));
test('rejects a preexisting linked input directory before writing through it',()=>fresh((root)=>{
  const owned=path.join(root,'owned');const outside=path.join(root,'outside');
  fs.mkdirSync(owned);fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside,'preserve.txt'),'unchanged',{flag:'wx'});
  fs.symlinkSync(outside,path.join(owned,'inputs'),'dir');
  assert.throws(()=>prepareWorkspace(origin,owned,source,io),{code:'EEXIST'});
  assert.equal(fs.readFileSync(path.join(outside,'preserve.txt'),'utf8'),'unchanged');
  assert.deepEqual(fs.readdirSync(outside),['preserve.txt']);
}));
