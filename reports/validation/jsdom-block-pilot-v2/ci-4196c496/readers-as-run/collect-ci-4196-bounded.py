"""Collect the completed CI artifacts as bytes; never execute their archived programs."""
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import signal
import stat
import sys
import zipfile

if sys.flags.optimize or os.name != 'posix':
    raise RuntimeError('CI artifact collection requires non-optimized Python on Linux')

REPOSITORY = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
ROOT = Path('/run/rustdom-ci-4196-artifacts-20261026')
SOURCE_COMMIT = '4196c496187c88c92304516287a7e644659a8536'
GH = '/mnt/c/Program Files/GitHub CLI/gh.exe'
PREFIX = 'repos/guidomodarelli/rustdom/'
RUNS = {
    'contracts': (40395417183, '.github/workflows/jsdom-block-pilot-v2-contracts.yml', 4, 4),
    'general': (40395416750, '.github/workflows/ci.yml', 8, 10),
}
MAX_ARCHIVE_BYTES = 120 * 1024 * 1024
MAX_COLLECTION_ARCHIVE_BYTES = 256 * 1024 * 1024
TRANSPORT_PATH = REPOSITORY / '.cache/qualify-bounded-git-transport.py'
TRANSPORT_SHA256 = '862e03c906aea630e252042e72bac4688d1c35ded06f91c465651fcea6b7b243'
MATERIALIZER_PATH = REPOSITORY / 'reports/validation/jsdom-block-pilot-v2/ci-57c3c2c9/materialize-ci-artifact.py'
MATERIALIZER_SHA256 = '4c3c07ee997a6ecd7ce76fec4d4df3b2801c89be38d5637d91744af82f74b7b0'
READER_DEPENDENCIES = {
    '.cache/bounded-git-transport-policy.json': 'c07202682c4781d11649cabe9f1e19f6baf62f9a3b6dfb2df345770a9b78c6e3',
    'reports/validation/jsdom-block-pilot-v2/ci-57c3c2c9/constants/expanded-storage.json': '3ba85318ed8c758fbe97fdb42c0803794203d7443f825514419e8baa8eeeb25d',
    'reports/validation/jsdom-block-pilot-v2/ci-57c3c2c9/constants/archive-storage.json': 'd35dfd8f60b71e0fd0b62f1d93da4015360087df5f554650ca4c6771424e0ab7',
    'reports/benchmarks/native-class-ownership/control-precision/pilot-v2/capture/supervise.py': '10964013affe148ca636cd25bd285f4f2ef3ad00b40dd43c159e2310380912db',
}


def verify_reader_dependencies(repository):
    """Close the executable reader dependency graph before loading either module."""
    for relative, expected in READER_DEPENDENCIES.items():
        path = repository / relative
        if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError('Reader dependency differs from the independently pinned bytes: ' + relative)


def load_current(path, expected, name):
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('Current reviewed reader bytes changed: ' + path.name)
    namespace = {'__name__': name, '__file__': str(path)}
    exec(compile(raw, str(path), 'exec'), namespace)
    return namespace


verify_reader_dependencies(REPOSITORY)
transport = load_current(TRANSPORT_PATH, TRANSPORT_SHA256, 'current_transport_helpers')
materializer = load_current(MATERIALIZER_PATH, MATERIALIZER_SHA256, 'current_zip_materializer')
transport['OUTPUT'] = ROOT / 'journals'


def timestamp(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def inventory_zip(archive_path):
    """Read every actual member and CRC while retaining the original ZIP unchanged."""
    policy = materializer['POLICY']
    records = []
    portable = set()
    total = 0
    with zipfile.ZipFile(archive_path) as archive:
        members = archive.infolist()
        if not 0 < len(members) <= policy['maximumMembers']:
            raise ValueError('ZIP member count exceeds the fixed bound')
        for member in members:
            if member.orig_filename != member.filename:
                raise ValueError('ZIP member was normalized by the platform')
            name = member.filename[:-1] if member.is_dir() else member.filename
            materializer['member_path'](name)
            kind = stat.S_IFMT(member.external_attr >> 16)
            if member.flag_bits & 1 or kind not in [0, stat.S_IFREG, stat.S_IFDIR]:
                raise ValueError('ZIP contains encrypted or special members')
            if name.casefold() in portable:
                raise ValueError('ZIP contains colliding portable names')
            portable.add(name.casefold())
            if member.is_dir():
                continue
            if not 0 <= member.file_size <= policy['maximumMemberBytes']:
                raise ValueError('ZIP member exceeds the fixed byte bound')
            total += member.file_size
            if total > policy['maximumExpandedBytes']:
                raise ValueError('ZIP expanded bytes exceed the fixed bound')
            checksum = hashlib.sha256()
            count = 0
            with archive.open(member) as reader:
                for chunk in iter(lambda: reader.read(1048576), b''):
                    count += len(chunk)
                    if count > member.file_size:
                        raise ValueError('ZIP streamed member exceeds its declared size')
                    checksum.update(chunk)
            if count != member.file_size:
                raise ValueError('ZIP streamed member is incomplete')
            records.append({'path': name, 'bytes': count, 'crc32': member.CRC, 'sha256': checksum.hexdigest()})
    files = {record['path'].casefold() for record in records}
    for record in records:
        if any(parent.as_posix().casefold() in files for parent in Path(record['path']).parents if parent.as_posix() != '.'):
            raise ValueError('ZIP file/directory collision')
    return records


def command(arguments, label, **kwargs):
    return transport['command'](arguments, label, **kwargs)


def api(endpoint, label):
    return command([GH, 'api', PREFIX + endpoint], label)


def collect():
    if ROOT.exists() or ROOT.is_symlink():
        raise FileExistsError('Collection root already exists; refuse without changing it')
    ROOT.mkdir()
    transport['OUTPUT'].mkdir()
    previous_handlers = transport['start_supervision']()
    try:
        if command(transport['GIT'] + ['rev-parse', 'HEAD'], 'source-head').decode().strip() != SOURCE_COMMIT:
            raise ValueError('Reviewed Linux source commit changed')
        if command(transport['GIT'] + ['status', '--porcelain'], 'source-clean') != b'':
            raise ValueError('Reviewed Linux source is not clean')
        records = []
        total_bytes = 0
        for role, (run_id, workflow_path, job_count, artifact_count) in RUNS.items():
            run = json.loads(api(f'actions/runs/{run_id}/attempts/1', role + '-run'))
            if run['head_sha'] != SOURCE_COMMIT or run['run_attempt'] != 1 or run['path'] != workflow_path:
                raise ValueError('CI run identity differs from the qualified source')
            if run['status'] != 'completed' or run['conclusion'] != 'success':
                raise ValueError('Only the completed successful qualified run may be collected')
            jobs = json.loads(api(f'actions/runs/{run_id}/attempts/1/jobs?per_page=100', role + '-jobs'))
            artifacts = json.loads(api(f'actions/runs/{run_id}/artifacts?per_page=100', role + '-artifacts'))
            if jobs['total_count'] != len(jobs['jobs']) or jobs['total_count'] != job_count:
                raise ValueError('Qualified CI job list is incomplete')
            if artifacts['total_count'] != len(artifacts['artifacts']) or artifacts['total_count'] != artifact_count:
                raise ValueError('Qualified CI artifact list is incomplete')
            for job in jobs['jobs']:
                if job['head_sha'] != SOURCE_COMMIT or job['run_attempt'] != 1 or job['conclusion'] != 'success':
                    raise ValueError('Qualified CI job identity or conclusion differs')
                api(f'actions/jobs/{job["id"]}/logs', role + '-job-' + str(job['id']))
            allowed = ({f'jsdom-block-{kind}-{version}-{SOURCE_COMMIT}' for kind in ['calendar','replay'] for version in ['22.12.0','24.14.1']}
                       if role == 'contracts' else {'validation-ubuntu-22.04','validation-windows-latest','validation-macos-latest',
                           'package-Linux-X64','package-Windows-X64','package-macOS-ARM64', *['benchmark-linux-' + str(index) for index in range(4)]})
            if {artifact['name'] for artifact in artifacts['artifacts']} != allowed:
                raise ValueError('Artifact names differ from the qualified fixed set')
            for artifact in artifacts['artifacts']:
                identity = str(artifact['id'])
                if artifact['workflow_run']['id'] != run_id or artifact['workflow_run']['head_sha'] != SOURCE_COMMIT:
                    raise ValueError('Artifact source/run identity differs')
                if artifact['expired'] or not 0 < artifact['size_in_bytes'] <= MAX_ARCHIVE_BYTES:
                    raise ValueError('Artifact is unavailable or exceeds the collection bound')
                if not timestamp(run['run_started_at']) <= timestamp(artifact['created_at']) <= timestamp(run['updated_at']):
                    raise ValueError('Artifact creation is outside the completed run interval')
                if json.loads(api(f'actions/artifacts/{identity}', 'metadata-' + identity)) != artifact:
                    raise ValueError('Artifact metadata changed during collection')
                total_bytes += artifact['size_in_bytes']
                if total_bytes > MAX_COLLECTION_ARCHIVE_BYTES:
                    raise ValueError('Collection archive byte bound exceeded')
                api(f'actions/artifacts/{identity}/zip', 'zip-' + identity)
                archive_path = transport['OUTPUT'] / ('zip-' + identity + '.stdout')
                checksum = transport['checksum_file'](archive_path)
                if archive_path.stat().st_size != artifact['size_in_bytes'] or artifact['digest'] != 'sha256:' + checksum:
                    raise ValueError('Original ZIP size or digest differs from GitHub metadata')
                record = {'id':artifact['id'], 'name':artifact['name'], 'role':role, 'runId':run_id, 'attempt':1,
                    'sourceCommit':SOURCE_COMMIT, 'bytes':artifact['size_in_bytes'], 'sha256':checksum,
                    'originalPath':archive_path.relative_to(ROOT).as_posix(), 'members':inventory_zip(archive_path)}
                records.append(record)
                (ROOT / ('artifact-' + identity + '.json')).write_bytes(json.dumps(record,indent=2).encode()+b'\n')
                print(json.dumps({'authenticatedArtifact':artifact['id'],'bytes':record['bytes'],'members':len(record['members'])}),flush=True)
        receipt = {'sourceCommit':SOURCE_COMMIT,'artifacts':records,'allFourteenArtifactsAuthenticated':len(records)==14,
            'archiveBytes':total_bytes,'originalApiResponsesAndLogsRetained':True,'DOMExecuted':False,
            'archivedCodeExecuted':False,'offlineReplayPerformed':False,'performanceAccepted':None,'gateReevaluated':False}
        (ROOT/'receipt.json').write_bytes(json.dumps(receipt,indent=2).encode()+b'\n')
        print(json.dumps({key:value for key,value in receipt.items() if key!='artifacts'}),flush=True)
    except BaseException as error:
        subtree = transport['settle_tree'](terminate=True)
        with (ROOT/'failure.json').open('xb') as writer:
            writer.write(json.dumps({'type':type(error).__name__,'message':str(error),'subtree':subtree,
                'partialBytesRetained':True,'studyExecuted':False},indent=2).encode()+b'\n')
        raise
    finally:
        for requested, handler in previous_handlers.items():
            signal.signal(requested, handler)


if __name__ == '__main__':
    if len(sys.argv) != 1:
        raise ValueError('Collector accepts no arguments')
    collect()
