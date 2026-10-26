"""Read authenticated hosted evidence as data; never import archive members or run DOM."""
import datetime
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Functional verification requires non-optimized Python')

ROOT = Path(__file__).resolve().parent.parent
POLICY = json.loads((ROOT / 'constants/reader.json').read_bytes())
PINS = json.loads((ROOT / 'confirmed/transport-pins.json').read_bytes())

def checksum(raw):
    return hashlib.sha256(raw).hexdigest()

def timestamp(value):
    return datetime.datetime.strptime(value, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=datetime.timezone.utc)

def read_pinned(directory, filename, digest):
    raw = (directory / filename).read_bytes()
    assert checksum(raw) == digest, filename
    return raw

def verify_artifact(repository, directory, artifact_id):
    """Verify an exact artifact against independent run/job/content pins and behavioral receipts."""
    pin = PINS['artifacts'][str(artifact_id)]
    layout = POLICY['layouts'][pin['kind']]
    metadata = json.loads(read_pinned(directory, 'metadata.json', pin['metadataSha256']))
    job = json.loads(read_pinned(directory, 'job.json', pin['jobSha256']))
    read_pinned(directory, 'job.log', pin['logSha256'])
    members = json.loads(read_pinned(directory, 'members.json', pin['membersSha256']))['files']
    raw = read_pinned(directory, 'artifact.zip', pin['sha256'])
    assert metadata['id'] == artifact_id and metadata['name'] == pin['name'] and not metadata['expired']
    assert len(raw) == metadata['size_in_bytes'] == pin['bytes']
    assert metadata['digest'] == 'sha256:' + pin['sha256']
    assert metadata['workflow_run']['id'] == pin['run'] and metadata['workflow_run']['head_sha'] == PINS['head']
    assert job['id'] == pin['jobId'] and job['run_id'] == pin['run'] and job['head_sha'] == PINS['head']
    assert job['run_attempt'] == PINS['attempt'] == 1 and job['status'] == 'completed' and job['conclusion'] == 'success'
    assert timestamp(job['started_at']) <= timestamp(metadata['created_at']) <= timestamp(job['completed_at'])
    platform = {'ubuntu-22.04': 'linux', 'windows-latest': 'win32', 'macos-latest': 'darwin'}[pin['platform']]
    if platform == 'win32':
        assert next(step for step in job['steps'] if step['name'] == POLICY['windowsSmoke'])['conclusion'] == 'success'
    declaration_raw = (repository / layout['declaration']).read_bytes()
    assert checksum(declaration_raw) == layout['declarationSha256']
    declaration = json.loads(declaration_raw)
    expected = declaration[layout['sourceKey']]
    with zipfile.ZipFile(directory / 'artifact.zip') as bundle:
        names = [member.filename for member in bundle.infolist() if not member.is_dir()]
        assert len(names) == len(set(names)) == len(members) and set(names) == set(members)
        for name in names:
            path = PurePosixPath(name)
            assert not path.is_absolute() and '..' not in path.parts and '\\' not in name
            contents = bundle.read(name)
            assert members[name] == {'bytes': len(contents), 'sha256': checksum(contents)}
        prefix = layout['prefix']
        def read(relative):
            return json.loads(bundle.read(prefix + relative))
        preparation, suite = read('preparation.json'), read('qualification.json')
        assert preparation['prepared'] is True and suite['qualified'] is True
        assert suite['revision'] == layout['revision'] and suite['node'] == pin['node'] and suite['platform'] == platform
        for receipt in [preparation, suite]:
            assert receipt['sourceCommit'] == POLICY['base'] and receipt['sourceGitErrors'] == []
            assert isinstance(receipt['sourceChangesRaw'], str)
            assert receipt['runtimeIntegrated'] is False and receipt['benchmarkExecuted'] is False
            assert receipt['performanceAccepted'] is None and receipt['gateReevaluated'] is False
        assert suite['sourceBeforeQualification'] == {key: preparation[key] for key in ['sourceCommit', 'sourceChangesRaw', 'sourceGitErrors']}
        if pin['kind'] == 'numeric':
            assert preparation['before'] == {'sourceCommit': POLICY['base'], 'sourceChangesRaw': '', 'sourceGitErrors': []}
            complete = read('composed-qualification.json')
            assert all(complete[key] is True for key in ['qualified', 'suiteQualificationComplete', 'collapseEvidenceComplete'])
            assert complete['revision'] == suite['revision'] and complete['sourceCommit'] == POLICY['base'] and complete['sourceGitErrors'] == []
            assert complete['sourceChangesRaw'] == suite['sourceChangesRaw']
            assert complete['performanceAccepted'] is None and complete['gateReevaluated'] is False and complete['benchmarkExecuted'] is False and complete['runtimeIntegrated'] is False
            assert complete['memoryCommand']['exitCode'] == 0 and complete['memoryCommand']['timedOut'] is False
            regression = read('qualification-regression.json')
            assert all(regression[key] is True for key in ['pass', 'callerOutputPreserved', 'callerEnvironmentRestored'])
        else:
            assert preparation['sourceBeforeChangesRaw'] == '' and preparation['sourceFiles'] == expected
            assert suite['preparedSource'] == preparation
            if pin['kind'] == 'owner':
                assert suite['extraConsumersPending'] is False
        assert [command['label'] for command in suite['commands']] == layout['labels']
        for command in suite['commands']:
            assert command['exitCode'] == 0 and command['timedOut'] is False
            for channel in ['stdout', 'stderr']:
                assert prefix + 'logs/' + command['label'] + '.' + channel + '.log' in names
        assert bundle.read(prefix + 'logs/node-version.stdout.log').decode().strip() == pin['node']
        source_prefixes = [name[:-len('dist/native-build.json')] for name in names if name.endswith('/artifacts/' + layout['sourceDirectory'] + '/dist/native-build.json')]
        assert len(source_prefixes) == 1
        source_prefix = source_prefixes[0]
        build = json.loads(bundle.read(source_prefix + 'dist/native-build.json'))
        native = checksum(bundle.read(source_prefix + 'dist/rustdom.node'))
        assert build == suite['nativeBuild'] and native == build['binarySha256'] and build['node'] == pin['node']
        if pin['kind'] == 'numeric':
            assert native == complete['nativeBinarySha256']
        archived, absent = [], []
        for relative, digest in expected.items():
            name = source_prefix + relative
            if name in names:
                assert checksum(bundle.read(name)) == digest, relative
                archived.append(relative)
            else:
                absent.append(relative)
        memory_results = []
        for relative in layout['memory']:
            probe = read(relative)
            assert probe['pass'] is True and probe['node'] == pin['node'] and len(probe['cycles']) == 6
            endpoints = []
            for cycle in probe['cycles']:
                released = cycle['released']
                assert released['reached'] is True and released['requiredClearSamples'] == 2
                assert len(released['trace']) >= 2 and all(sample['clear'] for sample in released['trace'][-2:])
                state = released['state']
                assert all(value == 0 for value in state['survivors'].values())
                assert ('window' in state['survivors'] or 'windows' in state['survivors']) and ('document' in state['survivors'] or 'documents' in state['survivors'])
                assert state['nativeTree']['liveNodes'] == 0 and state['nativeTree']['rangeStates']['live'] == 0
                endpoints.append({'cycle': cycle['cycle'], 'survivors': state['survivors'], 'nativeTree': state['nativeTree'], 'memory': state['memory']})
            memory_results.append({'log': relative, 'endpoints': endpoints})
        corpus = read('reports/validation/html5lib.json')
        assert corpus['node'] == pin['node'] and corpus['total'] == 1792 and corpus['passed'] == 1784 and corpus['excludedScriptOn'] == 8 and corpus['mismatches'] == []
        wpt_names = [name for name in names if name.startswith(prefix + 'reports/compatibility/') and name.endswith('-wpt.json')]
        assert len(wpt_names) == 1
        wpt = json.loads(bundle.read(wpt_names[0]))
        assert wpt['pass'] is True and wpt['node'] == pin['node'] and wpt['jsdom'] == '27.4.0'
        assert len(wpt['results']) == 240 and all(result['pass'] for result in wpt['results'])
        tests = [test for result in wpt['results'] for test in result['actual']['tests']]
        return {'artifactId': artifact_id, 'run': pin['run'], 'kind': pin['kind'], 'platform': platform, 'node': pin['node'],
            'functionalQualified': True, 'commandsPassed': len(suite['commands']) + (1 if pin['kind'] == 'numeric' else 0),
            'nativeBinarySha256': native, 'archivedDeclaredInputs': archived, 'declaredInputsNotArchived': absent,
            'memory': memory_results, 'corpusPassed': corpus['passed'], 'corpusExcluded': corpus['excludedScriptOn'],
            'wpt': {'fixtures': len(wpt['results']), 'assertions': len(tests), 'adverseAssertions': sum(test['status'] != 0 for test in tests),
                    'complete': wpt['complete'], 'excludedFixtures': wpt['excludedFixtures'], 'blockedSuites': wpt['blockedSuites']},
            'runtimeIntegrated': False, 'benchmarkExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False}

def verify_all(repository):
    results = []
    for kind, run in PINS['runs'].items():
        directory = ROOT / 'confirmed' / kind
        if kind in POLICY['layouts']:
            metadata = json.loads(read_pinned(directory, 'run.json', run['runSha256']))
            jobs = json.loads(read_pinned(directory, 'jobs.json', run['jobsSha256']))['jobs']
            assert metadata['id'] == run['id'] and metadata['head_sha'] == PINS['head'] and metadata['run_attempt'] == 1
            assert metadata['path'] == '.github/workflows/' + run['workflow'] and metadata['conclusion'] == 'success'
            assert len(jobs) == 6 and all(job['conclusion'] == 'success' for job in jobs)
        else:
            for filename, digest in run['files'].items():
                read_pinned(directory, filename, digest)
    for artifact_id, pin in PINS['artifacts'].items():
        results.append(verify_artifact(repository, ROOT / 'confirmed' / pin['kind'] / ('artifact-' + artifact_id), int(artifact_id)))
    assert len(results) == 18 and all(sum(result['kind'] == kind for result in results) == 6 for kind in POLICY['layouts'])
    return {'head': PINS['head'], 'artifacts': results, 'functionalJobsPassed': 18, 'generalCiPassed': True,
            'historicalOwnershipGatePassed': False, 'performanceAccepted': None, 'gateReevaluated': False}

if __name__ == '__main__':
    assert len(sys.argv) == 2, 'Provide current repository'
    print(json.dumps(verify_all(Path(sys.argv[1]).resolve(strict=True)), indent=2))
