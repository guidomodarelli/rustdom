import hashlib,json,os,pathlib,shutil,subprocess,tempfile,time
repository=pathlib.Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
tools=pathlib.Path('/mnt/c/Users/guido/ghq/projects/rustdom/.tools')
root=pathlib.Path(tempfile.mkdtemp(prefix='rustdom-current-preparation-'))
(repository/'.cache/current-preparation-root.txt').write_text(str(root)+'\n',encoding='utf-8')
fixtures=json.loads((repository/'.cache/current-build-input-fixtures.json').read_bytes())
linuxPath=lambda value:pathlib.Path('/mnt/c/'+value[3:].replace('\\','/'))
for label in ['baseline','candidate']:shutil.copytree(linuxPath(fixtures[label]['path']),root/label)
(root/'fixture-receipt.json').write_text(json.dumps(fixtures,indent=2)+'\n',encoding='utf-8')
nodes={'node-22':tools/'node-22/bin/node','node-24':tools/'node/bin/node'}
environment=dict(os.environ)
environment.update({'PATH':f'{tools}/node/bin:{tools}/rustup/toolchains/1.99.1-x86_64-unknown-linux-gnu/bin:'+environment['PATH'],
    'RUSTUP_TOOLCHAIN':'1.99.1','RUSTUP_HOME':str(tools/'rustup'),'CARGO_HOME':str(tools/'cargo'),
    'CARGO_TARGET_DIR':str(root/'target'),'CARGO_INCREMENTAL':'0',
    'RUSTDOM_CURRENT_INPUTS_BASELINE':str(root/'baseline'),'RUSTDOM_CURRENT_INPUTS_CANDIDATE':str(root/'candidate')})
(root/'prepared').mkdir();(root/'legacy').mkdir();(root/'commands').mkdir()
index={'complete':False,'measurementExecuted':False,'performanceAccepted':None,'root':str(root),'driverPid':os.getpid(),
    'startedAt':time.time(),'commands':[],'environment':{name:environment[name] for name in ['PATH','RUSTUP_TOOLCHAIN','RUSTUP_HOME','CARGO_HOME','CARGO_TARGET_DIR','CARGO_INCREMENTAL']}}
save=lambda:(root/'qualification.json').write_text(json.dumps(index,indent=2)+'\n',encoding='utf-8')
def digest(filename):
    checksum=hashlib.sha256()
    with pathlib.Path(filename).open('rb') as source:
        while chunk:=source.read(1048576):checksum.update(chunk)
    return checksum.hexdigest()
def execute(name,command,extra=None):
    record={'name':name,'argv':[str(value) for value in command],'cwd':str(repository),'startedAt':time.time(),
        'stdout':f'commands/{name}.stdout.log','stderr':f'commands/{name}.stderr.log'}
    index['commands'].append(record);save()
    local=dict(environment);local.update(extra or {})
    with (root/record['stdout']).open('xb') as stdout,(root/record['stderr']).open('xb') as stderr:
        child=subprocess.Popen(record['argv'],cwd=repository,env=local,stdout=stdout,stderr=stderr)
        record['pid']=child.pid;save();print(f'START {name} pid={child.pid}',flush=True)
        record['exitCode']=child.wait();record['finishedAt']=time.time();save()
    print(f'END {name} exit={record["exitCode"]}',flush=True)
    if record['exitCode']!=0:raise RuntimeError(f'Inspect {root/record["stderr"]}')
print(f'ROOT {root}',flush=True);save()
try:
    for label,node in nodes.items():execute(f'inputs-{label}',[node,'--test','reports/benchmarks/native-class-ownership/current-build-inputs.spec.cjs'])
    receipt=json.loads((repository/'reports/validation/native-class-ownership/hosted-build-ci/39720077911/receipt.json').read_bytes())
    archive=repository/'reports/validation/native-class-ownership/hosted-build-ci/39720077911/artifact-12400802735.zip'
    assert digest(archive)==receipt['artifactSha256']
    execute('extract-legacy-zip',['unzip','-q',archive,'-d',root/'legacy'])
    assert digest(root/'legacy/ownership-build.tar.gz')==receipt['tarSha256']
    execute('extract-legacy-tar',['tar','-xzf',root/'legacy/ownership-build.tar.gz','-C',root/'legacy'])
    execute('build-current',[nodes['node-24'],'reports/benchmarks/native-class-ownership/prepare-current-hosted-build.cjs',
        root/'baseline',root/'candidate',root/'prepared/ownership-build'])
    for label,node in reversed(list(nodes.items())):
        execute(f'functional-{label}',[node,'--expose-gc','reports/benchmarks/native-class-ownership/current-hosted-build-worker.cjs',root/'prepared/ownership-build'])
        shutil.copyfile(root/f'commands/functional-{label}.stdout.log',root/f'prepared/ownership-{label.replace("-","")}.json')
    shared={'RUSTDOM_HOSTED_BUILD_ARCHIVE':str(root/'prepared/ownership-build'),
        'RUSTDOM_LEGACY_HOSTED_BUILD_ARCHIVE':str(root/'legacy/ownership-build'),
        'RUSTDOM_CURRENT_INPUTS_BASELINE':str(root/'prepared/ownership-build/baseline-sources'),
        'RUSTDOM_CURRENT_INPUTS_CANDIDATE':str(root/'prepared/ownership-build/sources')}
    for label,node in nodes.items():
        execute(f'current-contracts-{label}',[node,'--test','reports/benchmarks/native-class-ownership/current-build-inputs.spec.cjs',
            'reports/benchmarks/native-class-ownership/prepare-current-hosted-build.spec.cjs'],shared)
        execute(f'legacy-contracts-{label}',[node,'--test','reports/benchmarks/native-class-ownership/prepare-hosted-build.spec.cjs'],
            {**shared,'RUSTDOM_HOSTED_BUILD_ARCHIVE':str(root/'legacy/ownership-build')})
    index['complete']=True;index['finishedAt']=time.time();save()
except Exception as error:
    index['failure']={'message':str(error),'type':type(error).__name__};index['finishedAt']=time.time();save();raise
