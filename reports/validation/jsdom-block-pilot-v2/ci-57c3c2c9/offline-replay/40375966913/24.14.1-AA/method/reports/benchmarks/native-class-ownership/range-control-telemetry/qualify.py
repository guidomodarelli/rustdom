"""Run portable offline contracts on current sources and exact published packages."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Range telemetry qualification requires non-optimized Python')

METHOD = Path(__file__).resolve().parent
SETTINGS = json.loads((METHOD / 'constants/qualification.json').read_bytes())
POLICY = json.loads((METHOD / 'constants/protocol.json').read_bytes())
FIXTURES = json.loads((METHOD / 'constants/fixtures.json').read_bytes())


def qualify(repository, destination, nodes, reader_versions=None):
    """Keep the real Git identity and all command failures; never invoke a sampler or profiler."""
    repository = Path(repository).resolve(strict=True)
    if METHOD != repository / POLICY['methodDirectory']:
        raise ValueError('Range telemetry qualification: run current code from the actual checkout')
    destination = Path(destination)
    destination = destination.parent.resolve(strict=True) / destination.name
    if destination.exists() or destination.is_symlink():
        raise FileExistsError(f'Range telemetry qualification: preserve existing output {destination}')
    if repository == destination or repository in destination.parents or destination in repository.parents:
        raise ValueError('Range telemetry qualification: output must be disjoint from source')
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repository, text=True).strip()
    if subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=repository):
        raise ValueError('Range telemetry qualification: require the actual clean source checkout')
    if len(nodes) != len(POLICY['nodeVersions']):
        raise ValueError('Range telemetry qualification: provide both fixed runtimes in declared order')
    runtimes = []
    for filename, version in zip(nodes, POLICY['nodeVersions']):
        node = Path(filename).resolve(strict=True)
        observed = subprocess.check_output([node, '--version'], text=True).strip()
        check = subprocess.run([node, '-e', 'require(process.argv[1]).requireRuntime()', METHOD / 'context.cjs'], cwd=repository, capture_output=True)
        if observed != version or check.returncode:
            raise ValueError(f'Range telemetry qualification: fixed runtime differs: {node}: {check.stderr.decode(errors="replace")}')
        runtimes.append({'executable': str(node), 'node': version, 'sha256': hashlib.sha256(node.read_bytes()).hexdigest()})
    selected = POLICY['nodeVersions'] if reader_versions is None else reader_versions
    if not selected or len(selected) != len(set(selected)) or any(version not in POLICY['nodeVersions'] for version in selected):
        raise ValueError('Range telemetry qualification: undeclared reader version')
    destination.mkdir()
    commands = []

    def execute(name, arguments, environment=None):
        arguments = [str(argument) for argument in arguments]
        try:
            result = subprocess.run(arguments, cwd=repository, env=environment, capture_output=True, timeout=SETTINGS['commandTimeoutSeconds'])
        except subprocess.TimeoutExpired as error:
            (destination / (name + '.stdout.log')).write_bytes(error.stdout or b'')
            (destination / (name + '.stderr.log')).write_bytes(error.stderr or b'')
            commands.append({'name': name, 'argv': arguments, 'exitCode': None, 'timedOut': True})
            (destination / 'commands.json').write_bytes((json.dumps(commands, indent=2) + '\n').encode())
            raise RuntimeError(f'Range telemetry qualification: {name} timed out; preserve {destination}') from error
        (destination / (name + '.stdout.log')).write_bytes(result.stdout)
        (destination / (name + '.stderr.log')).write_bytes(result.stderr)
        commands.append({'name': name, 'argv': arguments, 'exitCode': result.returncode})
        (destination / 'commands.json').write_bytes((json.dumps(commands, indent=2) + '\n').encode())
        if result.returncode:
            raise RuntimeError(f'Range telemetry qualification: {name} failed with exit {result.returncode}; preserve {destination}')
        return result.stdout

    legacy = destination / SETTINGS['legacyDirectory']
    preparation = destination / SETTINGS['preparationDirectory']
    execute('historical-fixtures', [sys.executable, '-B', METHOD / 'historical-fixtures.py', repository, legacy])
    execute('historical-fixtures-contracts', [sys.executable, '-B', METHOD / 'historical-fixtures.spec.py', repository, '-v'])
    execute('extract-prepared-packages', [sys.executable, '-B', repository / SETTINGS['extractor'], repository, preparation])
    package_root = preparation / SETTINGS['packageRoot']
    preflights = []
    plans = []
    for ordinal, runtime in enumerate(runtimes):
        plans.append(execute(f'node{ordinal}-plan', [runtime['executable'], METHOD / 'run.cjs', POLICY['operations']['plan']]))
        preflights.append(execute(f'node{ordinal}-preflight', [runtime['executable'], METHOD / 'run.cjs', POLICY['operations']['preflight'], package_root]))
    if any(item != plans[0] for item in plans) or any(item != preflights[0] for item in preflights):
        raise ValueError('Range telemetry qualification: plan/preflight bytes differ between fixed runtimes')
    checked = json.loads(preflights[0])
    manifest = {'commit': head, 'harnessSha256': checked['harness']['sha256'], 'files': checked['harness']['files']}
    manifest_file = destination / POLICY['paths']['sourceManifest']
    manifest_file.write_bytes((json.dumps(manifest, indent=2) + '\n').encode())
    for mode in POLICY['modes']:
        execute('derive-' + mode, [sys.executable, '-B', METHOD / 'prepare.py', repository, manifest_file, destination / (POLICY['paths']['derivedPrefix'] + mode), mode])
    (destination / FIXTURES['qaOwnerFile']).write_bytes((json.dumps({'revision': POLICY['revision'], 'role': FIXTURES['qaOwnerRole']}) + '\n').encode())
    environment = dict(os.environ, RANGE_TELEMETRY_QA=str(destination), RANGE_TELEMETRY_LEGACY=str(legacy),
                       RANGE_TELEMETRY_GIT_PROBE=str(repository / FIXTURES['gitProbe']))
    for ordinal, runtime in enumerate(runtimes):
        if runtime['node'] in selected:
            execute(f'node{ordinal}-contracts', [runtime['executable'], '--test', METHOD / 'model.spec.cjs', METHOD / 'contracts.spec.cjs'], environment)
    execute('preparation-contracts', [sys.executable, '-B', METHOD / 'prepare.spec.py', repository, manifest_file, *nodes, '-v'])
    changes = subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=repository, text=True).splitlines()
    if changes:
        raise ValueError('Range telemetry qualification: contracts changed the source checkout')
    result = {'sourceCommit': head, 'sourceChanges': changes, 'sourceGitErrors': [], 'runtimes': runtimes,
              'readerVersionsTested': selected, 'sourceFiles': checked['files'], 'commands': commands,
              'plansAndPreflightsByteIdentical': True, 'captureImplemented': POLICY['captureImplemented'],
              'DOMExecuted': False, 'newMeasurements': 0, 'fullNewCaptureReplayExercised': False,
              'performanceAccepted': None, 'gateReevaluated': False}
    (destination / 'verification.json').write_bytes((json.dumps(result, indent=2) + '\n').encode())
    return result


if __name__ == '__main__':
    if len(sys.argv) not in (5, 6):
        raise ValueError('Provide current repository, fresh output, fixed Node22/Node24 and optional reader version')
    print(json.dumps(qualify(sys.argv[1], sys.argv[2], sys.argv[3:5], sys.argv[5:] or None)))
