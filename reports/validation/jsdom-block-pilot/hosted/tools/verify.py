"""Verify the one published calendar CI run as bounded data; never execute archived code."""
import datetime
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import stat
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Pilot CI verification requires non-optimized Python')

POLICY = json.loads((Path(__file__).resolve().parent / 'constants/40286292347.json').read_bytes())
MAXIMUM_FILE_BYTES = 8388608

def checksum(raw):
    return hashlib.sha256(raw).hexdigest()

def instant(value):
    return datetime.datetime.strptime(value, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=datetime.timezone.utc)

def verify(directory, policy_id=None):
    """Use pins beside current code, independently of any policy supplied by the inspected directory."""
    policy = POLICY
    if policy_id is not None:
        if not isinstance(policy_id, str) or not policy_id.isascii() or not policy_id.isdecimal():
            raise ValueError('Pilot CI verification requires an ASCII numeric registered policy ID')
        policy = json.loads((Path(__file__).resolve().parent / 'constants' / (policy_id + '.json')).read_bytes())
        assert policy['runId'] == int(policy_id)
    directory = Path(directory)
    files = {}
    for name, expected in policy['files'].items():
        member = directory / name
        assert member.is_file() and not member.is_symlink() and member.stat().st_size <= MAXIMUM_FILE_BYTES, name
        with member.open('rb') as stream:
            raw = stream.read(MAXIMUM_FILE_BYTES + 1)
        assert len(raw) <= MAXIMUM_FILE_BYTES and checksum(raw) == expected, name
        files[name] = raw
    run = json.loads(files['run.json']); jobs = json.loads(files['jobs.json'])
    assert run['id'] == policy['runId'] and run['run_attempt'] == policy['attempt'] == 1
    assert run['head_sha'] == policy['head'] and run['path'] == policy['workflow']
    assert run['event'] == 'pull_request' and run['status'] == 'completed' and run['conclusion'] == 'success'
    assert jobs['total_count'] == len(jobs['jobs']) == len(policy['artifacts']) == 2
    assert {job['id'] for job in jobs['jobs']} == {artifact['jobId'] for artifact in policy['artifacts']}
    artifact_list = json.loads(files['artifacts.json'])
    assert artifact_list['total_count'] == len(artifact_list['artifacts']) == 2
    results = []
    for pin in policy['artifacts']:
        version = pin['node']; metadata = json.loads(files[version + '-metadata.json'])
        assert metadata == next(item for item in artifact_list['artifacts'] if item['id'] == pin['artifactId'])
        assert not metadata['expired'] and metadata['name'] == f'jsdom-block-calendar-{version}-{policy["head"]}'
        assert metadata['workflow_run']['id'] == policy['runId'] and metadata['workflow_run']['head_sha'] == policy['head']
        archive = files[version + '-artifact.zip']
        assert len(archive) == metadata['size_in_bytes'] == pin['bytes']
        assert metadata['digest'] == 'sha256:' + checksum(archive) == 'sha256:' + pin['sha256']
        job = next(item for item in jobs['jobs'] if item['id'] == pin['jobId'])
        assert job['name'] == 'Calendario y medias Node ' + version and job['run_id'] == policy['runId']
        assert job['run_attempt'] == 1 and job['head_sha'] == policy['head']
        assert job['status'] == 'completed' and job['conclusion'] == 'success'
        assert instant(job['started_at']) <= instant(metadata['created_at']) <= instant(job['completed_at'])
        expected_members = json.loads(files[version + '-members.json'])
        contents = {}
        with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
            members = bundle.infolist(); names = [member.filename for member in members]
            assert len(names) == len(set(names)) == len(expected_members) == policy.get('expectedZipMembers', 7)
            assert set(names) == set(expected_members)
            for member in members:
                name = member.filename; path = PurePosixPath(name)
                assert not path.is_absolute() and '..' not in path.parts and '\\' not in name
                assert not member.is_dir() and stat.S_IFMT(member.external_attr >> 16) in [0, stat.S_IFREG]
                assert member.file_size <= MAXIMUM_FILE_BYTES
                raw = bundle.read(member)
                assert expected_members[name] == {'bytes': len(raw), 'sha256': checksum(raw)}
                contents[name] = raw
        assert checksum(contents['calendar.json']) == policy['calendarSha256']
        calendar = json.loads(contents['calendar.json']); preparation = json.loads(contents['checkout.json'])
        assert calendar['criteria'] == 32 and calendar['blocks'] == 512 and calendar['processes'] == 16384
        assert calendar['executionReady'] is False and calendar['scientificCaptureExecuted'] is False
        assert calendar['performanceAccepted'] is None and calendar['gateReevaluated'] is False
        assert preparation['prepared'] is True and preparation['head'] == policy['head'] and preparation['requestedFiles'] == policy['inputFiles']
        assert preparation['runtimeExecuted'] is False and preparation['benchmarkExecuted'] is False
        summary = contents['tests.stdout.log'].decode('utf-8')
        for label, expected in [('tests', policy['testsPerSdk']), ('pass', policy['testsPerSdk']), ('fail', 0), ('cancelled', 0), ('skipped', 0), ('todo', 0)]:
            counts = re.findall(r'(?m)^(?:#|ℹ) ' + re.escape(label) + r' (\d+)\r?$', summary)
            assert counts == [str(expected)], label
        assert not contents['tests.stderr.log'] and not contents['checkout.stderr.log'] and not contents['plan.stderr.log']
        reader_tests = policy.get('readerTestsPerSdk', 0)
        if reader_tests:
            log = contents['reader-tests.stderr.log'].decode('utf-8')
            counts = re.findall(r'(?m)^Ran (\d+) tests? in [0-9.]+s\r?$', log)
            assert counts == [str(reader_tests)] and 'OK' in log.splitlines()
            assert not contents['reader.stderr.log']
            original_reader = json.loads(contents['reader.json'])
            assert original_reader['runId'] == 40286292347 and original_reader['jobsPassed'] == 2
            assert original_reader['scientificCaptureExecuted'] is False and original_reader['performanceAccepted'] is None
        results.append({'node': version, 'artifactId': pin['artifactId'], 'jobId': job['id'], 'testsPassed': policy['testsPerSdk'], 'readerTestsPassed': reader_tests})
    return {'runId': policy['runId'], 'qualifiedHead': policy['head'], 'jobsPassed': 2, 'artifacts': results,
        'calendarSha256': policy['calendarSha256'], 'scope': policy.get('scope', 'calendar-and-synthetic-scalar-contracts-only'),
        'archivedCodeExecuted': False, 'scientificCaptureExecuted': False,
        'performanceAccepted': None, 'gateReevaluated': False}

if __name__ == '__main__':
    assert len(sys.argv) in [2, 3], 'Provide calendar CI dataset and optional registered numeric policy ID'
    print(json.dumps(verify(Path(sys.argv[1]).resolve(strict=True), sys.argv[2] if len(sys.argv) == 3 else None), indent=2))
