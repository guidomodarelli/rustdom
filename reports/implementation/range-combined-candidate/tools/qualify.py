"""Build and exercise the exact prepared candidate on the active platform, preserving complete diagnostics."""
import json
import os
from pathlib import Path
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Combined candidate qualification requires non-optimized Python')

from prepare import POLICY as PREPARATION, digest, git_snapshot
from command import run_command

POLICY = json.loads((Path(__file__).parent / 'constants/qualification.json').read_bytes())


def qualify(repository, source, proof, node):
    """Run real builds, consumers, public suites and resource probes without accepting performance."""
    repository, source, proof, node = [path.resolve(strict=True) for path in [repository, source, proof, node]]
    assert (source / '.git').is_dir(), 'Combined candidate qualification: require native Git directory'
    preparation = json.loads((proof / PREPARATION['preparationFile']).read_bytes())
    assert preparation['prepared'] and preparation['sourceCommit'] == PREPARATION['baseCommit']
    assert not (proof / POLICY['commandsFile']).exists(), 'Combined candidate qualification: preserve previous commands'
    assert not (proof / POLICY['qualificationFile']).exists(), 'Combined candidate qualification: preserve previous results'
    manifest = json.loads((repository / PREPARATION['sourceManifest']['path']).read_bytes())
    assert digest(repository / PREPARATION['sourceManifest']['path']) == PREPARATION['sourceManifest']['sha256']
    for relative, expected in manifest['sources'].items():
        assert digest(source / relative) == expected, relative
    for relative, expected in preparation['copiedTests'].items():
        assert digest(source / relative) == expected, relative
    initial = git_snapshot(source)
    assert initial['sourceCommit'] == PREPARATION['baseCommit'] and not initial['sourceGitErrors']
    assert initial['sourceChangesRaw'] == preparation['sourceChangesRaw'], 'Combined candidate qualification: prepared source changed'
    logs = proof / POLICY['directories']['logs']; logs.mkdir()
    environment = dict(os.environ, PATH=str(node.parent) + os.pathsep + os.environ.get('PATH', ''),
                       RUSTUP_TOOLCHAIN='1.99.1', RUSTDOM_STATIC_RANGE_SOURCE=str(source),
                       RUSTDOM_COMBINED_SOURCE=str(source), RUSTDOM_RANGE_PREPARATION_SOURCE=str(source))
    npm = next((node.parent / relative for relative in POLICY['npmCliCandidates'] if (node.parent / relative).is_file()), None)
    assert npm is not None, 'Combined candidate qualification: bundled npm-cli.js not found beside Node'
    before_reports = {file.relative_to(source / 'reports').as_posix(): digest(file)
                      for file in (source / 'reports').rglob('*') if file.is_file()}
    record = {'revision': POLICY['revision'], 'qualified': False, 'platform': sys.platform,
              'executionSource': str(source), 'preparedSource': preparation,
              'sourceBeforeQualification': initial, 'commands': [],
              'runtimeIntegrated': False, 'benchmarkExecuted': False,
              'performanceAccepted': None, 'gateReevaluated': False,
              'nodeBinarySha256': digest(node), 'npmCliSha256': digest(npm)}

    def run(label, argv):
        command = run_command(label, argv, source, environment, logs,
                              POLICY['commandTimeoutSeconds'], POLICY['cleanupTimeoutSeconds'])
        record['commands'].append(command)
        (proof / POLICY['commandsFile']).write_text(json.dumps(record['commands'], indent=2) + '\n', encoding='utf-8', newline='\n')
        print(json.dumps(command), flush=True)
        assert command['exitCode'] == 0 and not command['timedOut'], 'Combined candidate qualification failed: ' + label

    try:
        run('node-version', [node, '--version'])
        version = (logs / 'node-version.stdout.log').read_text(encoding='utf-8').strip()
        assert version in POLICY['nodes'], 'Combined candidate qualification: unsupported Node version'
        record['node'] = version
        run('npm-version', [node, npm, '--version'])
        run('rustc-version', ['rustc', '-Vv'])
        assert (logs / 'rustc-version.stdout.log').read_text(encoding='utf-8').startswith(POLICY['rustVersion'] + ' ')
        run('cargo-version', ['cargo', '--version'])
        run('format', ['cargo', 'fmt', '--check'])
        run('dependencies', [node, npm, 'ci', '--no-audit', '--no-fund'])
        run('rust-tests', ['cargo', 'test', '--release', '--locked', '--lib'])
        run('native-build', [node, 'scripts/build-native.mjs'])
        run('clippy', ['cargo', 'clippy', '--all-targets', '--release', '--locked', '--', '-D', 'warnings'])
        run('js-build', [node, 'scripts/build.mjs'])
        native_build = json.loads((source / 'dist/native-build.json').read_bytes())
        assert digest(source / 'dist/rustdom.node') == native_build['binarySha256']
        record['nativeBuild'] = native_build
        consumers = source / POLICY['directories']['consumers']
        run('compile-consumers', [node, source / 'node_modules/typescript/bin/tsc', '--strict', '--module', 'NodeNext',
                                 '--target', 'ES2022', '--esModuleInterop', '--skipLibCheck', 'false', '--types', 'node',
                                 '--rootDir', source, '--outDir', consumers,
                                 *[source / name for name in POLICY['consumerInputs']]])
        for extension in ['cjs', 'mjs']:
            run('consumer-' + extension, [node, consumers / 'tests/consumers' / ('consumer.' + extension)])
        run('directed', [node, *POLICY['nodeArguments'], *sorted((source / 'tests').glob('range-*.spec.cjs')),
                         source / PREPARATION['interactionTarget'], repository / POLICY['publicTests']])
        for suite in POLICY['suites']:
            run(suite.replace(':', '-'), [node, npm, 'run', suite])
        run('static-memory', [node, '--expose-gc', repository / POLICY['staticMemory']])
        run('collapse-memory', [node, '--expose-gc', source / POLICY['collapseMemory']])
        for relative, expected in manifest['sources'].items():
            assert digest(source / relative) == expected, relative
        assert digest(source / 'dist/rustdom.node') == native_build['binarySha256']
        record['qualified'] = True
    except Exception as error:
        record['failure'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        for file in (source / 'reports').rglob('*'):
            if file.is_file():
                relative = file.relative_to(source / 'reports').as_posix()
                if digest(file) != before_reports.get(relative):
                    target = proof / POLICY['directories']['reports'] / relative
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(file.read_bytes())
        observed = git_snapshot(source)
        record.update(observed)
        git_failed = bool(observed['sourceGitErrors']) or observed['sourceCommit'] != PREPARATION['baseCommit']
        if git_failed:
            record['qualified'] = False
            record.setdefault('failure', {'type': 'GitProvenanceError', 'message': 'Final source Git provenance failed'})
        (proof / POLICY['qualificationFile']).write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8', newline='\n')
        if git_failed:
            raise RuntimeError('Combined candidate qualification: final Git provenance failed; inspect qualification.json')
    return record


if __name__ == '__main__':
    assert len(sys.argv) == 5, 'Provide repository, prepared source, proof directory and pinned Node executable'
    result = qualify(*map(Path, sys.argv[1:]))
    print(json.dumps({key: result[key] for key in ['qualified', 'platform', 'node', 'runtimeIntegrated', 'benchmarkExecuted', 'performanceAccepted', 'gateReevaluated']}))
