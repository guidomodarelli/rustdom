"""Exercise metadata/ZIP boundaries using the actual preserved 33-artifact run and real files."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import signal
import stat
import sys
import zipfile

sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
import runtime
import artifacts


def suite(arguments):
    root = arguments.root
    root.mkdir(exist_ok=False)
    for name in ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN']:
        os.environ[name] = 'transport-local-test-token'
    os.environ['GH_CONFIG_DIR'] = str(root/'private-config')
    runtime.configure(source=arguments.source,output=root/'journals',work=root/'work',
        branch='feature/pilot-v2-ci-evidence',namespace='reports/validation/artifact-boundaries',native_cli=arguments.cli)
    original = {name:json.loads((arguments.collection/(name+'.json')).read_bytes()) for name in ['run','jobs','artifacts']}
    criteria = json.loads((arguments.source/'reports/benchmarks/native-class-ownership/control-precision/pilot/capture/files.json').read_bytes())['criteria']
    options = {'run_id':40366685759,'source_commit':'1078e4fd190276a116e6dc5e64c9fe32eca3e7e9',
        'workflow_path':'.github/workflows/jsdom-block-pilot-capture.yml','criteria':criteria}
    records = []
    plan = artifacts.metadata_plan(**original,**options)
    if (not plan['allExpectedArtifactsAvailable'] or len(plan['records']) != 33 or plan['missingArtifactNames']
            or plan['runConclusion'] != 'failure' or [record['ordinal'] for record in plan['records'][1:]] != list(range(32))):
        raise AssertionError('Actual failed run was not bound to all 33 preserved artifacts')
    records.append({'case':'actual-33-artifact-terminal-failure-is-preservable','passed':True})
    cases = [
        ('attempt',lambda data:data['run'].update(run_attempt=2)),
        ('source',lambda data:data['run'].update(head_sha='0'*40)),
        ('workflow',lambda data:data['run'].update(path='.github/workflows/ci.yml')),
        ('live-run',lambda data:data['run'].update(status='in_progress')),
        ('pagination',lambda data:data['artifacts'].update(total_count=34)),
        ('duplicate-artifact',lambda data:data['artifacts']['artifacts'].__setitem__(1,copy.deepcopy(data['artifacts']['artifacts'][0]))),
        ('unexpected-artifact',lambda data:data['artifacts']['artifacts'][0].update(name='outside-plan')),
        ('artifact-source',lambda data:data['artifacts']['artifacts'][0]['workflow_run'].update(head_sha='0'*40)),
        ('artifact-run',lambda data:data['artifacts']['artifacts'][0]['workflow_run'].update(id=1)),
        ('expired-artifact',lambda data:data['artifacts']['artifacts'][0].update(expired=True)),
        ('boolean-size',lambda data:data['artifacts']['artifacts'][0].update(size_in_bytes=True)),
        ('excess-size',lambda data:data['artifacts']['artifacts'][0].update(size_in_bytes=runtime.POLICY['maximumArchiveBytes']+1)),
        ('invalid-digest',lambda data:data['artifacts']['artifacts'][0].update(digest=None)),
        ('outside-time',lambda data:data['artifacts']['artifacts'][0].update(created_at='2000-01-01T00:00:00Z')),
        ('duplicate-job',lambda data:data['jobs']['jobs'].__setitem__(1,copy.deepcopy(data['jobs']['jobs'][0]))),
        ('job-attempt',lambda data:data['jobs']['jobs'][0].update(run_attempt=2)),
    ]
    for label,mutate in cases:
        data = copy.deepcopy(original)
        mutate(data)
        try:
            artifacts.metadata_plan(**data,**options)
        except ValueError:
            pass
        else:
            raise AssertionError('Invalid metadata was accepted: '+label)
        records.append({'case':'reject-'+label,'passed':True})
    partial = copy.deepcopy(original)
    partial['artifacts']['artifacts'] = [artifact for artifact in partial['artifacts']['artifacts'] if artifact['name'].startswith('jsdom-pilot-consumption-')]
    partial['artifacts']['total_count'] = 1
    partial['jobs']['jobs'] = [job for job in partial['jobs']['jobs'] if job['name'] == 'preflight']
    partial['jobs']['total_count'] = 1
    observed = artifacts.metadata_plan(**partial,**options)
    if observed['allExpectedArtifactsAvailable'] or len(observed['missingArtifactNames']) != 32 or len(observed['missingJobNames']) != 32:
        raise AssertionError('Partial run did not preserve all missing criteria explicitly')
    records.append({'case':'partial-run-never-claims-completeness','passed':True})
    item = plan['records'][1]
    original_zip = arguments.zip if arguments.zip is not None else arguments.collection/(str(item['metadata']['id'])+'.zip')
    if runtime.checksum_path(original_zip) != item['metadata']['digest'][7:]:
        raise ValueError('Real preserved ZIP differs from the original API digest')
    inventory = artifacts.inventory_zip(original_zip)
    extracted = root/'actual-criterion-zip'
    if artifacts.inventory_zip(original_zip,extracted) != inventory:
        raise AssertionError('Extraction changed the real authenticated inventory')
    for entry in inventory:
        filename = extracted/entry['path']
        if filename.stat().st_size != entry['bytes'] or runtime.checksum_path(filename) != entry['sha256']:
            raise AssertionError('Real extracted member differs')
    records.append({'case':'real-criterion-zip-inventory-and-extraction','files':len(inventory),'passed':True})
    try:
        artifacts.inventory_zip(original_zip,extracted)
    except FileExistsError:
        pass
    else:
        raise AssertionError('ZIP extraction overwrote an existing directory')
    records.append({'case':'existing-extraction-refused','passed':True})
    sentinel = arguments.source/'AGENTS.md'
    sentinel_before = sentinel.read_bytes()
    forbidden = arguments.source/'transport-extraction-forbidden'
    if forbidden.exists():
        raise FileExistsError('Expected absent source fixture destination already exists')
    for destination in [arguments.source,forbidden,arguments.source.parent]:
        try:
            artifacts.inventory_zip(original_zip,destination)
        except ValueError:
            pass
        else:
            raise AssertionError('ZIP extraction accepted the producer checkout or its ancestor')
    if forbidden.exists() or sentinel.read_bytes() != sentinel_before:
        raise AssertionError('ZIP extraction mutated the protected producer source')
    records.append({'case':'producer-source-and-ancestors-protected-with-real-sentinel','passed':True})
    def reject_zip(label,entries):
        filename = root/(label+'.zip')
        with zipfile.ZipFile(filename,'x') as archive:
            for name,raw,mode in entries:
                member = zipfile.ZipInfo(name)
                member.create_system = 3
                member.external_attr = mode << 16
                archive.writestr(member,raw)
        destination = root/(label+'-out')
        try:
            artifacts.inventory_zip(filename,destination)
        except ValueError:
            pass
        else:
            raise AssertionError('Unsafe ZIP was accepted: '+label)
        if destination.exists():
            raise AssertionError('Unsafe ZIP wrote files before namespace validation: '+label)
        records.append({'case':'reject-zip-'+label,'passed':True})
    reject_zip('traversal',[('../outside',b'bad',stat.S_IFREG|0o600)])
    reject_zip('case-alias',[('a.json',b'1',stat.S_IFREG|0o600),('A.json',b'2',stat.S_IFREG|0o600)])
    reject_zip('file-parent',[('a',b'1',stat.S_IFREG|0o600),('a/b',b'2',stat.S_IFREG|0o600)])
    reject_zip('symlink',[('link',b'../outside',stat.S_IFLNK|0o777)])
    reject_zip('reserved',[('CON.json',b'bad',stat.S_IFREG|0o600)])
    reject_zip('control',[('bad\x7f.json',b'bad',stat.S_IFREG|0o600)])
    reject_zip('backslash',[('a\\b.json',b'bad',stat.S_IFREG|0o600)])
    reject_zip('empty',[])
    reject_zip('directory-payload',[('payload/',b'bad',stat.S_IFDIR|0o700)])
    reject_zip('inconsistent-directory-type',[('directory',b'',stat.S_IFDIR|0o700)])
    summary = {'cases':records,'dataRunId':40366685759,'dataAttempt':1,'newDOMExecuted':False,
        'maintainedCodeSha256':{relative:runtime.checksum_path(Path(__file__).resolve().parent.parent/relative)
            for relative in ['runtime.py','artifacts.py','constants/runtime.json','constants/artifacts.json','tests/test_artifacts.py']},
        'GitHubInvoked':False,'realCredentialsRead':False,'archivedCodeExecuted':False,
        'scientificCaptureExecuted':False,'performanceAccepted':None,'gateReevaluated':False}
    (root/'summary.json').write_bytes(json.dumps(summary,indent=2).encode()+b'\n')
    print(json.dumps({'passed':len(records)}),flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for name in ['source','root','cli','collection']:
        parser.add_argument('--'+name,type=Path,required=True)
    parser.add_argument('--zip',type=Path)
    suite(parser.parse_args())
