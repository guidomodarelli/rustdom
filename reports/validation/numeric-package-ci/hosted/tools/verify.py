"""Authenticate functional CI receipts as data; never import or execute artifact members."""
import datetime
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Hosted package verification requires non-optimized Python')

POLICY = json.loads((Path(__file__).resolve().parent / 'constants/40277876693.json').read_bytes())

def checksum(raw):
    return hashlib.sha256(raw).hexdigest()

def checked(directory, filename, expected):
    raw = (directory / filename).read_bytes()
    assert checksum(raw) == expected, filename
    return raw

def timestamp(value):
    return datetime.datetime.strptime(value, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=datetime.timezone.utc)

def tests(raw, count, skipped=0):
    """Interpret unittest's public result without altering the original Windows CR/CR/LF bytes."""
    observed = re.search(rb'Ran (\d+) tests? in [0-9.]+s', raw)
    assert observed is not None and int(observed.group(1)) == count
    lines = raw.decode('utf-8').splitlines()
    assert ('OK (skipped=' + str(skipped) + ')' if skipped else 'OK') in lines
    return {'run': count, 'passed': count - skipped, 'skipped': skipped}

def verify(directory, policy_id=None):
    """Select only a registered policy beside current code; never use a policy supplied by inspected data."""
    if policy_id is None:
        policy = POLICY
    else:
        if not policy_id.isascii() or not policy_id.isdecimal():
            raise ValueError('Hosted package verification requires a numeric registered policy ID')
        policy = json.loads((Path(__file__).resolve().parent / 'constants' / (policy_id + '.json')).read_bytes())
        assert policy['runId'] == int(policy_id)
    expected = policy['expected']
    assert policy['complete'] is True and policy['status'] == 'completed' and policy['conclusion'] == 'success'
    assert policy['attempt'] == 1 and len(policy['artifacts']) == 2
    run = json.loads(checked(directory, 'run.json', policy['runSha256']))
    jobs = json.loads(checked(directory, 'jobs.json', policy['jobsSha256']))['jobs']
    assert run['id'] == policy['runId'] and run['head_sha'] == policy['head'] and run['run_attempt'] == 1
    assert run['path'] == '.github/workflows/numeric-composed-package-contracts.yml' and run['event'] == 'pull_request'
    assert run['status'] == 'completed' and run['conclusion'] == 'success' and len(jobs) == 2
    results = []
    for artifact_id, pin in policy['artifacts'].items():
        artifact = directory / ('artifact-' + artifact_id)
        metadata = json.loads(checked(artifact, 'metadata.json', pin['metadataSha256']))
        job = json.loads(checked(artifact, 'job.json', pin['jobSha256']))
        checked(artifact, 'job.log', pin['logSha256'])
        members = json.loads(checked(artifact, 'members.json', pin['membersSha256']))['files']
        raw = checked(artifact, 'artifact.zip', pin['sha256'])
        assert metadata['id'] == int(artifact_id) and metadata['name'] == pin['name'] and not metadata['expired']
        assert len(raw) == pin['bytes'] == metadata['size_in_bytes'] and metadata['digest'] == 'sha256:' + pin['sha256']
        assert metadata['workflow_run']['id'] == policy['runId'] and metadata['workflow_run']['head_sha'] == policy['head']
        assert job['id'] == pin['jobId'] and job['run_id'] == policy['runId'] and job['head_sha'] == policy['head']
        assert job['run_attempt'] == 1 and job['status'] == 'completed' and job['conclusion'] == pin['jobConclusion'] == 'success'
        assert job == next(item for item in jobs if item['id'] == job['id'])
        assert timestamp(job['started_at']) <= timestamp(metadata['created_at']) <= timestamp(job['completed_at'])
        platform = pin['platform']
        assert job['name'] == 'Paquete numérico ' + platform
        assert metadata['name'] == f'numeric-package-{platform}-{policy["head"]}'
        with zipfile.ZipFile(artifact / 'artifact.zip') as bundle:
            names = [member.filename for member in bundle.infolist() if not member.is_dir()]
            assert len(names) == len(set(names)) == len(members) and set(names) == set(members)
            for name in names:
                assert not PurePosixPath(name).is_absolute() and '..' not in PurePosixPath(name).parts and '\\' not in name
                contents = bundle.read(name)
                assert members[name] == {'bytes': len(contents), 'sha256': checksum(contents)}
            preparation = json.loads(bundle.read('checkout.json'))
            assert preparation['prepared'] is True and preparation['head'] == policy['head'] and preparation['requestedFiles'] == expected['inputFiles']
            assert preparation['runtimeExecuted'] is False and preparation['benchmarkExecuted'] is False
            summary = {'platform': platform, 'artifactId': int(artifact_id), 'jobId': job['id'],
                'checkout': tests(bundle.read('checkout-tests.stderr.log'), expected['checkoutTests']),
                'transport': tests(bundle.read('transport-tests.stderr.log'), expected['transportTests'], expected['windowsSkipped'] if platform == 'windows-latest' else 0)}
            memory = []
            if platform == 'ubuntu-22.04':
                summary['assembly'] = tests(bundle.read('assembly-tests.stderr.log'), expected['assemblyTests'])
                extraction = json.loads(bundle.read('extraction.json'))
                assert extraction['verified'] is True and extraction['extracted'] is True and extraction['members'] == expected['packageMembers'] and extraction['links'] == expected['packageLinks']
                assert extraction['archiveSha256'] == expected['packageArchiveSha256']
                for version, node_version in expected['nodes'].items():
                    state = json.loads(bundle.read('node' + version + '.json'))
                    assert state['pass'] is True and state['node'] == node_version and state['artifactId'] == expected['runtimeArtifactId']
                    assert state['packageAuthenticatedBeforeRuntimeLoad'] is True and state['nativeBinarySha256'] == expected['nativeBinarySha256']
                    assert state['runtimeExecuted'] is True and state['benchmarkExecuted'] is False and state['performanceAccepted'] is None and state['gateReevaluated'] is False
                    assert len(state['cycles']) == expected['memoryCycles']
                    for cycle in state['cycles']:
                        released = cycle['released']
                        assert released['reached'] is True and released['requiredClearSamples'] == 2
                        assert len(released['trace']) >= 2 and all(sample['clear'] for sample in released['trace'][-2:])
                        assert released['state']['survivors'] == {'window': 0, 'document': 0, 'ranges': 0, 'native': 0}
                        assert released['state']['nativeTree']['liveNodes'] == 0 and released['state']['nativeTree']['rangeStates']['live'] == 0
                    memory.append(state)
                summary['memory'] = memory
            else:
                assert platform == 'windows-latest' and len(names) == 6
            results.append(summary)
    assert {item['platform'] for item in results} == {'windows-latest', 'ubuntu-22.04'}
    return {'runId': policy['runId'], 'qualifiedHead': policy['head'], 'jobsPassed': 2, 'artifacts': results,
        'producerCanonicalIndexSealPresent': expected['producerCanonicalIndexSealPresent'],
        'scope': expected['scope'],
        'newScientificCaptureExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False}

if __name__ == '__main__':
    assert len(sys.argv) in [2, 3], 'Provide authenticated hosted dataset directory and optional registered policy ID'
    print(json.dumps(verify(Path(sys.argv[1]).resolve(strict=True), sys.argv[2] if len(sys.argv) == 3 else None), indent=2))
