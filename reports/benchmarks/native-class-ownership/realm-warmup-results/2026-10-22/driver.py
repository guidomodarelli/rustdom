import hashlib,io,json,os,pathlib,subprocess,tarfile,tempfile,time
repo=pathlib.Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
publication=json.loads((repo/'.cache/realm-warmup-publication.json').read_bytes())
blob=(repo/'.cache/realm-warmup-published-harness.tar').read_bytes()
assert hashlib.sha256(blob).hexdigest()==publication['publishedHarnessTarSha256']
root=pathlib.Path(tempfile.mkdtemp(prefix='rustdom-realm-warmup-study-'))
harness=root/'harness';harness.mkdir()
with tarfile.open(fileobj=io.BytesIO(blob)) as stream:
    for member in stream:
        if member.isfile():
            target=harness/member.name
            assert target.resolve().is_relative_to(harness.resolve())
            target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(stream.extractfile(member).read())
marker=repo/'.cache/realm-warmup-study.started.json'
with marker.open('x',encoding='utf-8') as destination:
    json.dump({'root':str(root),'driverPid':os.getpid(),'startedAt':time.time(),
        'head':publication['head'],'optimizationCaptureRepeated':False},destination,indent=2)
(repo/'.cache/realm-warmup-study-root.txt').write_text(str(root)+'\n',encoding='utf-8')
(root/'publication.json').write_text(json.dumps(publication,indent=2)+'\n',encoding='utf-8')
(root/'provenance.json').write_text(json.dumps(publication['provenance'],indent=2)+'\n',encoding='utf-8')
script=harness/'reports/benchmarks/native-class-ownership/realm-warmup-experiment.cjs'
prepared='/tmp/rustdom-ownership-results-m7jq3638/independent-order/prepared/ownership-build'
nodes={'node-22':'/mnt/c/Users/guido/ghq/projects/rustdom/.tools/node-22/bin/node',
    'node-24':'/mnt/c/Users/guido/ghq/projects/rustdom/.tools/node/bin/node'}
environment=dict(os.environ);environment.pop('NODE_OPTIONS',None)
print(f'ROOT {root}',flush=True)
for label,node in nodes.items():
    command=[node,str(script),prepared,str(root/label),str(root/'provenance.json')]
    record={'command':command,'cwd':str(harness),'startedAt':time.time()}
    with (root/f'{label}.stdout.log').open('xb') as stdout,(root/f'{label}.stderr.log').open('xb') as stderr:
        child=subprocess.Popen(command,cwd=harness,env=environment,stdout=stdout,stderr=stderr)
        record['pid']=child.pid
        print(f'START {label} pid={child.pid}',flush=True)
        record['exitCode']=child.wait();record['finishedAt']=time.time()
    (root/f'{label}.process.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
    print(f'END {label} exit={record["exitCode"]}',flush=True)
    if record['exitCode'] not in [0,1]:raise SystemExit(record['exitCode'])
with (root/'verification.json').open('xb') as stdout,(root/'verification.stderr.log').open('xb') as stderr:
    code=subprocess.call([nodes['node-24'],str(script),'--verify-set',str(root/'node-22'),str(root/'node-24')],
        cwd=harness,env=environment,stdout=stdout,stderr=stderr)
(root/'verification.exit-code').write_text(str(code)+'\n',encoding='utf-8')
print(f'COMPLETE verifyExit={code}',flush=True)
raise SystemExit(code)
