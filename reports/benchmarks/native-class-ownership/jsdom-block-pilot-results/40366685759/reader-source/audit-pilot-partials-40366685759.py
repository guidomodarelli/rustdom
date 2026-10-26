"""Audit every original partial with current readers and both pinned SDKs. No worker execution, data filling or archived imports."""
from pathlib import Path
import hashlib
import importlib.util
import json
import shutil
import subprocess
import tarfile
import zipfile

repository=Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
primary=Path('/mnt/c/Users/guido/ghq/projects/rustdom')
collection=repository/'.cache/pilot-study-40366685759/collection'
output=repository/'.cache/pilot-study-40366685759/audit';output.mkdir(exist_ok=False)
scratch=Path('/dev/shm/pilot-partial-audit-40366685759');scratch.mkdir(exist_ok=False)
head='1078e4fd190276a116e6dc5e64c9fe32eca3e7e9';run_id=40366685759
pilot=repository/'reports/benchmarks/native-class-ownership/control-precision/pilot'
policy=json.loads((pilot/'constants/capture.json').read_bytes())
publication_path=repository/policy['publication']
publication_sha=hashlib.sha256(publication_path.read_bytes()).hexdigest()
assert publication_sha=='f85ec2b26d1839f7130a7bee4e02e560f6497f4003c7c0b2cf3f8c140402f2c1'
publication=json.loads(publication_path.read_bytes());expected_files=publication['files']
criteria=json.loads((pilot/'capture/files.json').read_bytes())['criteria']
receipt=json.loads((collection/'receipt.json').read_bytes());assert receipt['originalArtifactsAuthenticated']==33
preflight=next(record for record in receipt['artifacts'] if record['ordinal'] is None)
consumption_file=collection/('artifact-'+str(preflight['artifactId']))/'capture-consumption.json'
consumption_raw=consumption_file.read_bytes();consumption_sha=hashlib.sha256(consumption_raw).hexdigest()
consumption=json.loads(consumption_raw);assert consumption['allowed'] and consumption['sourceCommit']==head and consumption['currentRunId']==run_id
assert all(item['run']['head_sha']==head for item in consumption['qualifications'])
module_file=pilot/'capture/archive.py'
specification=importlib.util.spec_from_file_location('current_reviewed_archive_reader',module_file)
reader=importlib.util.module_from_spec(specification);specification.loader.exec_module(reader)
sdks=[]
for version,relative,checksum in [('22.12.0','.tools/node-22/bin/node','177208bfc4a9403121a40c72d038c670f4fd937fa16ca7df0a720e90be0fe2d9'),
                                 ('24.14.1','.tools/node/bin/node','bf9112eb83a827dc9f9c8d19bb7bddcbf00f7b2fedae18fdcaee05406981f20a')]:
    executable=primary/relative;assert hashlib.sha256(executable.read_bytes()).hexdigest()==checksum
    sdks.append((version,executable))

def current_digest(file):
    checksum=hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1048576),b''):checksum.update(chunk)
    return checksum.hexdigest()

results=[]
for record in sorted((item for item in receipt['artifacts'] if item['ordinal'] is not None),key=lambda item:item['ordinal']):
    ordinal=record['ordinal'];criterion=criteria[ordinal]
    folder=collection/('artifact-'+str(record['artifactId']))
    archive_meta=json.loads((folder/'archive.json').read_bytes())
    original_expected=json.loads((folder/'expected.json').read_bytes())
    independent={'mode':'capture','criterionId':criterion['criterionId'],'sourceCommit':head,'files':expected_files,
                 'requireComplete':True,'requireSupervisor':True,'runId':run_id,
                 'publicationSha256':publication_sha,'consumptionSha256':consumption_sha}
    assert original_expected==independent
    tar_path=collection/(str(record['artifactId'])+'.tar.gz')
    with zipfile.ZipFile(collection/(str(record['artifactId'])+'.zip')) as archive:
        assert archive.read('archive.json')==(folder/'archive.json').read_bytes()
        with archive.open('criterion.tar.gz') as source,tar_path.open('xb') as destination:
            shutil.copyfileobj(source,destination,1024*1024)
    assert tar_path.stat().st_size==archive_meta['archiveBytes'] and current_digest(tar_path)==archive_meta['archiveSha256']
    extracted=scratch/str(ordinal).zfill(4)
    transport=reader.read_archive(tar_path,archive_meta['archiveSha256'],extracted)
    files=transport['files']
    assert policy['indexFile'] not in files and policy['captureStartFile'] not in files
    assert not any(name.startswith('workers/') for name in files)
    assert not any(name.startswith('inputs/') and name!=policy['packageSnapshot'] for name in files)
    assert files[policy['publicationSnapshot']]['sha256']==publication_sha
    assert json.loads((extracted/policy['publicationSnapshot']).read_bytes())==publication
    assert files[policy['consumptionFile']]['sha256']==consumption_sha
    snapshot=json.loads((extracted/policy['methodSnapshotIndex']).read_bytes())
    assert set(snapshot)==set(expected_files)
    for relative,expected_sha in expected_files.items():
        role='embedded-package' if relative==policy['packageArchive'] else 'published-reference' if Path(relative).suffix in policy['publishedReferenceExtensions'] else 'copied-source'
        location=policy['packageSnapshot'] if role=='embedded-package' else policy['methodSnapshotDirectory']+'/'+relative if role=='copied-source' else None
        observed=snapshot[relative]
        assert observed['role']==role and observed['location']==location and observed['sha256']==expected_sha
        assert observed['bytes']==(repository/relative).stat().st_size
        if location is not None:
            assert files[location]['sha256']==expected_sha and files[location]['bytes']==observed['bytes']
    failure=(folder/'capture.stderr.log').read_text()
    assert 'EEXIST' in failure and "mkdir '/home/runner/work/_temp/pilot-criterion/inputs'" in failure
    assert (folder/'capture.stdout.log').read_bytes()==b''
    supervisor=json.loads((folder/'supervisor.json').read_bytes())
    assert supervisor['mode']=='capture' and supervisor['complete'] and supervisor['parentExitCode']==2 and supervisor['exitCode']==2
    assert supervisor['ownedDescendantsRemaining']==[] and not supervisor['deadlineReached'] and not supervisor['interrupted']
    assert supervisor['argv'][-1]==criterion['criterionId'] and supervisor['nodeExecutableSha256']==policy['nodeExecutables'][criterion['node']]
    replay_records=[]
    for version,executable in sdks:
        result_path=output/(str(ordinal).zfill(4)+'-node'+version+'.json')
        with result_path.with_suffix('.stdout.log').open('xb') as stdout,result_path.with_suffix('.stderr.log').open('xb') as stderr:
            process=subprocess.run([str(executable),str(pilot/'capture/verify.cjs'),str(extracted),str(folder/'expected.json'),str(result_path),'--allow-partial'],
                stdout=stdout,stderr=stderr,timeout=120)
        assert process.returncode==1
        replay=json.loads(result_path.read_bytes())
        assert replay['complete'] is False and replay['reason']=='no-index' and replay['analysis'] is None
        assert replay['sourceBindingChecked'] is False
        replay_records.append({'node':version,'exitCode':1,'complete':False,'reason':'no-index'})
    result={'ordinal':ordinal,'criterionId':criterion['criterionId'],'artifactId':record['artifactId'],
        'tarSha256':archive_meta['archiveSha256'],'tarBytes':tar_path.stat().st_size,'tarInventory':transport,
        'sourceSnapshotMembersIndependentlyChecked':len(expected_files),'sourceSnapshotBindingChecked':True,
        'consumedReceiptSha256':consumption_sha,'failure':'EEXIST inputs during preparation',
        'indexMissing':True,'captureStartMarkerMissing':True,'benchmarkWorkerFiles':0,'taskRecords':0,
        'parentMemorySnapshotsAvailable':False,'supervisor':supervisor,'replays':replay_records,
        'performanceAccepted':None,'gateReevaluated':False}
    (output/(str(ordinal).zfill(4)+'-audit.json')).write_bytes(json.dumps(result,indent=2).encode()+b'\n')
    results.append({key:value for key,value in result.items() if key not in ['tarInventory','supervisor']})
    (output/'progress.json').write_bytes(json.dumps({'auditedCriteria':len(results),'expectedCriteria':32,'results':results},indent=2).encode()+b'\n')
    assert extracted.resolve().is_relative_to(scratch.resolve()) and extracted.name==str(ordinal).zfill(4)
    shutil.rmtree(extracted)
    print(json.dumps({'ordinal':ordinal,'sourcesChecked':850,'partialReplays':2,'workerFiles':0,'sameEexist':True}),flush=True)
assert len(results)==32
summary={'runId':run_id,'attempt':1,'sourceCommit':head,'methodConsumed':True,'conclusion':'technical-preparation-failure',
    'artifactsAuthenticated':33,'criteriaAudited':32,'sourceSnapshotBindingsChecked':32,'partialReplays':64,
    'benchmarkWorkersLaunched':0,'measuredDurationsRecorded':0,'warmupDurationsRecorded':0,
    'windowEndpointMeasurements':0,'documentEndpointMeasurements':0,'parentMemorySnapshots':0,
    'expectedBenchmarkWorkers':16384,'expectedMeasuredDurations':2359296,'expectedWarmupDurations':786432,
    'missingDataNotFilled':True,'failure':'inputs already exists after source snapshot, before index/start marker/worker loop',
    'readerDOMExecuted':False,'archivedCodeExecuted':False,'sequenceRepeated':False,
    'performanceAccepted':None,'gateReevaluated':False,'peakMemoryMeasured':False,'universalLeakFreedomDemonstrated':False,
    'limits':'Zero worker execution is inferred from all 32 matching setup failures, missing markers/index/worker files and the authenticated producer control flow; no Window/Document endpoint or parent-memory claim is made.'}
(output/'summary.json').write_bytes(json.dumps(summary,indent=2).encode()+b'\n')
print(json.dumps(summary),flush=True)
