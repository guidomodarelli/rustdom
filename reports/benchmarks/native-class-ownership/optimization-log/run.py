"""Preserve one optimization-log observation using the original, authenticated sampler."""
import hashlib
import json
import math
import os
import pathlib
import platform
import re
import shutil
import subprocess
import sys
import time
import traceback


METHOD = pathlib.Path(__file__).resolve().parent
REPOSITORY = METHOD.parents[3]
SETTINGS = json.loads((METHOD / 'constants/settings.json').read_bytes())
if sys.flags.optimize:
    raise RuntimeError('Optimization log: run without -O or PYTHONOPTIMIZE so integrity checks remain enabled')


def digest(filename):
    checksum = hashlib.sha256()
    with pathlib.Path(filename).open('rb') as source:
        while chunk := source.read(SETTINGS['hashChunkBytes']):
            checksum.update(chunk)
    return checksum.hexdigest()


def write_json(filename, value):
    pathlib.Path(filename).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')


def source_identity():
    names = [SETTINGS['sourceLedger'], SETTINGS['protocol']] + [
        (METHOD / name).relative_to(REPOSITORY).as_posix() for name in SETTINGS['methodFiles']]
    return {name: digest(REPOSITORY / name) for name in sorted(names)}


def verify_publication(publication):
    if not isinstance(publication, dict) or not re.fullmatch('[0-9a-f]{40}', str(publication.get('commit', ''))):
        raise ValueError('Optimization log: provide an authenticated publication object and commit')
    if publication.get('files') != source_identity():
        raise ValueError('Optimization log: publication source inventory differs from runtime files')


def frozen_sources(inputs):
    ledger_path = REPOSITORY / SETTINGS['sourceLedger']
    assert digest(ledger_path) == SETTINGS['sourceLedgerSha256'], 'Optimization log: changed source ledger'
    ledger = json.loads(ledger_path.read_bytes())
    assert ledger['harnessSha256'] == SETTINGS['harnessSha256']
    root = pathlib.Path(inputs['frozenHarness']).resolve()
    for entry in ledger['files']:
        filename = root / entry['path']
        assert filename.stat().st_size == entry['bytes'] and digest(filename) == entry['sha256'], entry['path']
    return ledger


def inspect_report(report, node, physical, reference):
    label = 'A' if physical == 'J0' else 'B'
    assert report['complete'] and not report['gateReevaluated']
    assert (report['node'], report['phase'], report['engine'], report['position'], report['label']) == (node, 'AA', 'jsdom', 0, label)
    assert report['schedule']['physical'] == physical
    expected = [(batch['name'], batch['size'], batch['outputHash']) for batch in reference['batches']]
    assert [(batch['name'], batch['size'], batch['outputHash']) for batch in report['batches']] == expected, 'Optimization log: incomplete or changed public workload'
    for ordinal, batch in enumerate(report['batches']):
        assert batch['complete'] and len(batch['samplesMs']) == 9
        assert all(type(value) in [int, float] and math.isfinite(value) and value > 0 for value in batch['samplesMs'])
        assert batch['trackedOwners'] == {'window': (ordinal + 1) * 12, 'document': (ordinal + 1) * 12}
        assert len(batch['cleanupTrace']) == 3
        for endpoint in batch['cleanupTrace'][-2:]:
            assert endpoint['clear'] and endpoint['survivors'] == {'window': 0, 'document': 0}
    for name in ['loadedBefore', 'loadedAfter']:
        assert set(report[name]) == set(reference[name]), 'Optimization log: incomplete loaded-package inventory'
        assert all(bool(filenames) == (loaded_physical == physical) for loaded_physical, filenames in report[name].items())
    return {'batches': len(report['batches']), 'storedMeasuredDurations': sum(len(batch['samplesMs']) for batch in report['batches']),
            'trackedWindows': report['batches'][-1]['trackedOwners']['window']}


def run_process(argv, directory, index, save, name, read_stdout=True):
    """Keep raw logs on disk; only read small version, capability and preparation outputs."""
    directory.mkdir()
    record = {'name': name, 'argv': argv, 'directory': str(directory), 'complete': False, 'startedAtUnix': time.time()}
    index['commands'].append(record)
    save()
    with (directory / 'stdout.log').open('xb') as stdout, (directory / 'stderr.log').open('xb') as stderr:
        child = subprocess.Popen(argv, stdout=stdout, stderr=stderr)
        record['pid'] = child.pid
        save()
        record['exitCode'] = child.wait()
    record['finishedAtUnix'] = time.time()
    record['complete'] = True
    save()
    if record['exitCode'] != 0:
        raise RuntimeError(f"Optimization log: {name} failed with exit={record['exitCode']}; preserved {directory}")
    return (directory / 'stdout.log').read_bytes() if read_stdout else None


def prepare(inputs, output, index, save):
    assert platform.system() == 'Linux' and platform.machine() == 'x86_64'
    index['host'].update({'python': platform.python_version(),
        'cpuModel': next(line.split(':', 1)[1].strip() for line in pathlib.Path('/proc/cpuinfo').read_text().splitlines() if line.startswith('model name')),
        'memoryTotal': next(line for line in pathlib.Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemTotal:'))})
    for name in SETTINGS['forbiddenEnvironment']:
        assert name not in os.environ, f'Optimization log: inherited {name}'
    ledger = frozen_sources(inputs)
    manifest_path = pathlib.Path(inputs['localManifest']).resolve()
    assert digest(manifest_path) == SETTINGS['localManifestSha256'], 'Optimization log: changed local manifest'
    manifest = json.loads(manifest_path.read_bytes())
    harness = pathlib.Path(inputs['frozenHarness']).resolve()
    reference_path = harness.parent / 'AA-0-jsdom-A.json'
    assert digest(reference_path) == SETTINGS['referenceReportSha256'], 'Optimization log: changed public output reference'
    reference = json.loads(reference_path.read_bytes())
    assert len(inputs['nodes']) == len(SETTINGS['nodeVersions'])
    identities = []
    for ordinal, (node, version) in enumerate(zip(inputs['nodes'], SETTINGS['nodeVersions'])):
        node = str(pathlib.Path(node).resolve())
        assert run_process([node, '--version'], output / f'node-{ordinal}-version', index, save, 'node-version').decode().strip() == version
        options = run_process([node, '--v8-options'], output / f'node-{ordinal}-options', index, save, 'v8-options').decode()
        assert all(flag in options for flag in SETTINGS['flags']), 'Optimization log: unavailable V8 flag'
        identities.append({'node': node, 'version': version, 'sha256': digest(node)})
    index['tools'] = identities
    index['preparationExpected'] = manifest['preparationBefore']
    index['frozenSourceFiles'] = len(ledger['files'])
    save()
    return manifest, reference, ledger


def claim_capture_guard(filename, output, commit):
    filename.parent.mkdir(parents=True, exist_ok=True)
    with filename.open('x', encoding='utf-8') as marker:
        json.dump({'output': str(output), 'pid': os.getpid(), 'publication': commit}, marker)


def main(inputs, output_argument, publication=None, capture=False):
    if capture:
        verify_publication(publication)
    output = pathlib.Path(output_argument).resolve()
    for root in [METHOD, pathlib.Path(inputs['frozenHarness']).resolve(), pathlib.Path(inputs['preparation']).resolve(), pathlib.Path(inputs['localManifest']).resolve().parent]:
        assert output != root and root not in output.parents and output not in root.parents, 'Optimization log: output overlaps immutable input'
    output.mkdir()
    index = {'complete': False, 'captureStarted': False, 'diagnosticOnly': True, 'accepted': None, 'gateReevaluated': False,
             'settings': SETTINGS, 'inputs': inputs, 'publication': publication, 'methodSources': source_identity(),
             'host': {'platform': platform.platform(), 'cpuCount': os.cpu_count()}, 'commands': [], 'workers': []}
    save = lambda: write_json(output / 'index.json', index)
    save()
    try:
        manifest, reference, ledger = prepare(inputs, output, index, save)
        for name in index['methodSources']:
            destination = output / 'sources/method' / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(REPOSITORY / name, destination)
        for entry in ledger['files']:
            destination = output / 'sources/frozen' / entry['path']
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(pathlib.Path(inputs['frozenHarness']) / entry['path'], destination)
        shutil.copyfile(inputs['localManifest'], output / 'local-manifest.json')
        shutil.copyfile(pathlib.Path(inputs['frozenHarness']).parent / 'AA-0-jsdom-A.json', output / 'reference-report.json')
        if capture:
            claim_capture_guard(REPOSITORY / SETTINGS['captureGuard'], output, publication['commit'])
            index['captureStarted'] = True
            save()
        for ordinal, tool in enumerate(index['tools']):
            node, version = tool['node'], tool['version']
            helper = str(pathlib.Path(inputs['frozenHarness']) / SETTINGS['preparationHelper'])
            check = [node, '-e', 'const study=require(process.argv[1]);process.stdout.write(JSON.stringify(study.inspectPreparation(process.argv[2])));', helper, inputs['preparation']]
            before = json.loads(run_process(check, output / f'node-{ordinal}-before', index, save, 'preparation-before'))
            assert before == manifest['preparationBefore']
            frozen_sources(inputs)
            if capture:
                for physical in SETTINGS['physicalOrder'][ordinal]:
                    directory = output / f'node-{ordinal}-{physical}'
                    label = 'A' if physical == 'J0' else 'B'
                    argv = [node, *SETTINGS['flags'], str(pathlib.Path(inputs['frozenHarness']) / SETTINGS['worker']),
                            inputs['localManifest'], 'AA', 'jsdom', '0', label, str(directory / 'report.json')]
                    run_process(argv, directory, index, save, physical, read_stdout=False)
                    report = json.loads((directory / 'report.json').read_bytes())
                    assert report['pid'] == index['commands'][-1]['pid'], 'Optimization log: worker PID differs from child'
                    assert report['execArgv'] == SETTINGS['flags']
                    result = inspect_report(report, version, physical, reference)
                    index['workers'].append({'node': version, 'physical': physical, 'directory': str(directory), **result})
                    save()
                    print(json.dumps(index['workers'][-1]), flush=True)
            after = json.loads(run_process(check, output / f'node-{ordinal}-after', index, save, 'preparation-after'))
            assert after == before
            frozen_sources(inputs)
            assert digest(node) == tool['sha256'], 'Optimization log: executable changed'
        assert source_identity() == index['methodSources'], 'Optimization log: method changed during execution'
        index['complete'] = True
        index['files'] = {item.relative_to(output).as_posix(): digest(item) for item in sorted(output.rglob('*')) if item.is_file() and item != output / 'index.json'}
        save()
        return index
    except BaseException as error:
        index['failure'] = {'type': type(error).__name__, 'message': str(error), 'stack': traceback.format_exc()}
        save()
        raise


if __name__ == '__main__':
    try:
        if sys.argv[1] == '--sources':
            print(json.dumps(source_identity(), indent=2))
        else:
            mode, inputs_file, output = sys.argv[1:4]
            assert mode in ['--preflight', '--capture'], 'Optimization log: choose --preflight or --capture'
            inputs = json.loads(pathlib.Path(inputs_file).read_bytes())
            publication = json.loads(pathlib.Path(sys.argv[4]).read_bytes()) if mode == '--capture' else None
            result = main(inputs, output, publication, mode == '--capture')
            print(json.dumps({'complete': result['complete'], 'captureStarted': result['captureStarted'],
                              'workers': len(result['workers']), 'accepted': None, 'gateReevaluated': False}, indent=2))
    except BaseException as error:
        sys.stderr.write(traceback.format_exc())
        sys.exit(2)
