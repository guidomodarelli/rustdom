"""Replay functional qualification receipts as data, without importing or executing archived code."""
import hashlib
import json
import datetime
from pathlib import Path
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Hosted artifact verification requires non-optimized Python')

POLICY = json.loads((Path(__file__).parent / 'constants/qualification.json').read_bytes())
HEAD, RUN, BASE, REVISION, LABELS, PREFIX = [POLICY[key] for key in ['head', 'run', 'base', 'revision', 'labels', 'prefix']]

def checksum(raw):
    return hashlib.sha256(raw).hexdigest()

def api_timestamp(value):
    """Parse the API's UTC timestamp without changing the retained metadata bytes."""
    return datetime.datetime.strptime(value, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=datetime.timezone.utc)

def verify(repository, directory):
    """Authenticate transport bytes and the complete conjunction of actual hosted functional receipts."""
    metadata = json.loads((directory / 'metadata.json').read_bytes())
    members = json.loads((directory / 'members.json').read_bytes())
    archive = (directory / 'artifact.zip').read_bytes()
    pin = POLICY['artifacts'][str(metadata['id'])]
    assert metadata['name'] == pin['name'] and metadata['size_in_bytes'] == pin['bytes']
    assert metadata['digest'] == 'sha256:' + pin['sha256']
    assert checksum(archive) == pin['sha256'] and len(archive) == pin['bytes']
    job_bytes = (directory / 'job.json').read_bytes()
    assert checksum(job_bytes) == pin['jobSha256']
    job = json.loads(job_bytes)
    assert job['id'] == pin['jobId'] and job['run_id'] == RUN and job['head_sha'] == HEAD
    assert job['run_attempt'] == 1 and job['status'] == 'completed' and job['conclusion'] == 'success'
    observed_at = api_timestamp(metadata['created_at'])
    assert api_timestamp(job['started_at']) <= observed_at <= api_timestamp(job['completed_at'])
    assert metadata['workflow_run']['id'] == RUN and metadata['workflow_run']['head_sha'] == HEAD
    assert members['runId'] == RUN and members['attempt'] == 1 and members['head'] == HEAD
    assert members['artifactId'] == metadata['id'] and not metadata['expired']
    assert len(archive) == metadata['size_in_bytes']
    assert 'sha256:' + checksum(archive) == metadata['digest']
    assert checksum(archive) == members['archiveSha256']
    with zipfile.ZipFile(directory / 'artifact.zip') as bundle:
        names = [item.filename for item in bundle.infolist() if not item.is_dir()]
        assert len(names) == len(set(names)) == len(members['files'])
        assert set(names) == set(members['files'])
        for name in names:
            assert not name.startswith('/') and '..' not in Path(name).parts
            raw = bundle.read(name)
            assert members['files'][name] == {'bytes': len(raw), 'sha256': checksum(raw)}
        def read(relative):
            return json.loads(bundle.read(PREFIX + relative))
        preparation = read('preparation.json')
        suite = read('qualification.json')
        complete = read('composed-qualification.json')
        regression = read('qualification-regression.json')
        assert preparation['prepared'] and preparation['before'] == {
            'sourceCommit': BASE, 'sourceChangesRaw': '', 'sourceGitErrors': []}
        assert suite['qualified'] and complete['qualified']
        assert complete['suiteQualificationComplete'] and complete['collapseEvidenceComplete']
        assert suite['sourceBeforeQualification'] == {key: preparation[key]
            for key in ['sourceCommit', 'sourceChangesRaw', 'sourceGitErrors']}
        for receipt in [preparation, suite, complete]:
            assert receipt['revision'] == REVISION and receipt['sourceCommit'] == BASE
            assert receipt['sourceGitErrors'] == [] and isinstance(receipt['sourceChangesRaw'], str)
            assert receipt['runtimeIntegrated'] is False and receipt['benchmarkExecuted'] is False
            assert receipt['performanceAccepted'] is None and receipt['gateReevaluated'] is False
        assert complete['sourceChangesRaw'] == suite['sourceChangesRaw']
        assert regression['pass'] and regression['callerOutputPreserved'] and regression['callerEnvironmentRestored']
        assert [command['label'] for command in suite['commands']] == LABELS
        for command in [*suite['commands'], complete['memoryCommand']]:
            assert command['exitCode'] == 0 and command['timedOut'] is False
        assert complete['memoryCommand']['label'] == 'collapse-memory'
        node = suite['node']
        assert node in ['v22.12.0', 'v24.14.1'] and suite['platform'] in ['linux', 'win32', 'darwin']
        platform = {'linux': 'ubuntu-22.04', 'win32': 'windows-latest', 'darwin': 'macos-latest'}[suite['platform']]
        assert metadata['name'] == f'range-numeric-composed-{platform}-{node[1:]}-{HEAD}'
        assert job['name'] == f'Extremos y colapso Range {platform} Node {node[1:]}'
        assert bundle.read(PREFIX + 'logs/node-version.stdout.log').decode().strip() == node
        for label in LABELS:
            for channel in ['stdout', 'stderr']:
                assert PREFIX + f'logs/{label}.{channel}.log' in names
        source_prefixes = [name[:-len('dist/native-build.json')] for name in names
                           if name.endswith('/artifacts/range-initialization-source/dist/native-build.json')]
        assert len(source_prefixes) == 1
        source_prefix = source_prefixes[0]
        native_build = json.loads(bundle.read(source_prefix + 'dist/native-build.json'))
        native_checksum = checksum(bundle.read(source_prefix + 'dist/rustdom.node'))
        assert native_checksum == native_build['binarySha256'] == suite['nativeBuild']['binarySha256'] == complete['nativeBinarySha256']
        assert native_build == suite['nativeBuild'] and native_build['node'] == node
        declaration = (repository / POLICY['declaration']).read_bytes()
        assert checksum(declaration) == POLICY['declarationSha256']
        expected = json.loads(declaration)['candidateInputs']
        assert len(expected) == 344
        archived_inputs = []
        for relative, digest in expected.items():
            name = source_prefix + relative
            if name in names:
                assert checksum(bundle.read(name)) == digest, relative
                archived_inputs.append(relative)
        for required in ['src/dom/native-tree.cjs', 'src/dom/range_state.rs', 'src/dom/range_state_binding.rs', 'types/native.d.cts']:
            assert required in archived_inputs
        memory = read('logs/memory.stdout.log')
        collapse = read('collapse-memory/collapse-memory.stdout.log')
        memory_summary = []
        for probe in [memory, collapse]:
            assert probe['pass'] and probe['node'] == node and len(probe['cycles']) == 6
            endpoints = []
            for cycle in probe['cycles']:
                released = cycle['released']
                assert released['reached'] and released['requiredClearSamples'] == 2
                assert len(released['trace']) >= 2 and all(sample['clear'] for sample in released['trace'][-2:])
                assert all(value == 0 for value in released['state']['survivors'].values())
                survivors = released['state']['survivors']
                assert ('window' in survivors or 'windows' in survivors) and ('document' in survivors or 'documents' in survivors)
                native = released['state']['nativeTree']
                assert native['liveNodes'] == 0 and native['rangeStates']['live'] == 0
                endpoints.append({'cycle': cycle['cycle'], 'survivors': survivors,
                                  'rangeStates': native['rangeStates'], 'napiClasses': native['napiClasses'],
                                  'memory': released['state']['memory']})
            memory_summary.append(endpoints)
        corpus = read('reports/validation/html5lib.json')
        assert corpus['node'] == node and corpus['total'] == 1792 and corpus['passed'] == 1784
        assert corpus['excludedScriptOn'] == 8 and corpus['mismatches'] == []
        wpt_names = [name for name in names if name.startswith(PREFIX + 'reports/compatibility/') and name.endswith('-wpt.json')]
        assert len(wpt_names) == 1
        wpt = json.loads(bundle.read(wpt_names[0]))
        assert wpt['pass'] and wpt['node'] == node and wpt['jsdom'] == '27.4.0'
        assert len(wpt['results']) == 240 and all(result['pass'] for result in wpt['results'])
        return {'artifactId': metadata['id'], 'node': node, 'platform': suite['platform'], 'qualified': True,
                'nativeBinarySha256': native_checksum, 'archiveSha256': checksum(archive),
                'archivedCompilerInputsVerified': len(archived_inputs), 'compilerInputsCheckedByHostedQualifier': 344,
                'commandsPassed': len(LABELS) + 1, 'memoryEndpoints': memory_summary,
                'corpus': {key: corpus[key] for key in ['total', 'passed', 'excludedScriptOn', 'mismatches', 'parserStatistics']},
                'wpt': {'fixtures': len(wpt['results']), 'pass': wpt['pass'], 'complete': wpt['complete'],
                        'excludedFixtures': wpt['excludedFixtures'], 'blockedSuites': wpt['blockedSuites']},
                'runtimeIntegrated': False, 'benchmarkExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False}

if __name__ == '__main__':
    assert len(sys.argv) == 3, 'Provide current repository and authenticated artifact directory'
    print(json.dumps(verify(Path(sys.argv[1]).resolve(strict=True), Path(sys.argv[2]).resolve(strict=True)), indent=2))
