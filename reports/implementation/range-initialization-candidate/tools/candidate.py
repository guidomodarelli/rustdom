"""Prepare and qualify the numeric endpoint candidate using real source provenance and bounded commands."""
import sys
if sys.flags.optimize:
    raise RuntimeError('Range initialization tools require non-optimized Python')
import hashlib
import json
import os
from pathlib import Path
import subprocess

POLICY = json.loads((Path(__file__).parent / 'constants/candidate.json').read_bytes())


def digest(filename):
    """Return the digest of unchanged bytes, without newline or Git identity normalization."""
    return hashlib.sha256(filename.read_bytes()).hexdigest()


def safe_relative(root, relative):
    """Reject paths escaping a declared source or packet before any mutation."""
    path = Path(relative)
    assert not path.is_absolute() and '..' not in path.parts and ':' not in relative
    target = root / path
    assert not target.is_symlink() and target.resolve().is_relative_to(root) and target.resolve() != root, relative
    return target


def identity(source):
    """Retain actual Git status and errors from a native Git directory."""
    observed = {'sourceCommit': None, 'sourceChangesRaw': None, 'sourceGitErrors': []}
    for arguments, field in [(['rev-parse', 'HEAD'], 'sourceCommit'),
                             (['status', '--porcelain', '--untracked-files=all'], 'sourceChangesRaw')]:
        result = subprocess.run(['git', *arguments], cwd=source, capture_output=True,
                                timeout=POLICY['gitTimeoutSeconds'])
        if result.returncode:
            observed['sourceGitErrors'].append(result.stderr.decode('utf-8', errors='replace'))
        else:
            value = result.stdout.decode('utf-8')
            observed[field] = value.strip() if field == 'sourceCommit' else value
    return observed


def inputs(repository):
    """Read the independent complete input inventory from the reviewed qualification."""
    filename = safe_relative(repository, POLICY['inputs']['path'])
    assert digest(filename) == POLICY['inputs']['sha256'], 'Range initialization: input declaration changed'
    return json.loads(filename.read_bytes())


def check_inputs(source, expected):
    """Authenticate every declared compiler/runtime input before and after qualification."""
    assert len(expected) == POLICY['compilerInputCount']
    for relative, checksum in expected.items():
        assert digest(safe_relative(source, relative)) == checksum, 'Range initialization: source changed: ' + relative


def save(filename, record):
    """Write UTF-8 receipt data without transforming source identity fields."""
    filename.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8', newline='\n')


def prepare(repository, source, proof):
    """Apply the reviewed patch only to a separate clean native checkout; preserve failed receipts."""
    repository, source = [directory.resolve(strict=True) for directory in [repository, source]]
    assert source != repository and (source / '.git').is_dir() and not (source / '.git').is_symlink()
    assert not proof.exists() and not proof.is_symlink(), 'Range initialization: preserve existing proof'
    proof = proof.parent.resolve(strict=True) / proof.name
    for protected in [repository, source]:
        assert proof != protected and not proof.is_relative_to(protected) and not protected.is_relative_to(proof)
    proof.mkdir()
    record = {'revision': POLICY['revision'], 'prepared': False, 'runtimeIntegrated': False,
              'benchmarkExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False, 'commands': []}
    try:
        initial = identity(source)
        record['before'] = initial
        assert initial['sourceCommit'] == POLICY['baseCommit'] and not initial['sourceGitErrors']
        assert initial['sourceChangesRaw'] == '', 'Range initialization: preserve dirty checkout'
        declaration = inputs(repository)
        check_inputs(source, declaration['productionInputs'])
        packet = safe_relative(repository, POLICY['packet'])
        patch = safe_relative(packet, POLICY['patch']['path'])
        assert digest(patch) == POLICY['patch']['sha256'], 'Range initialization: patch changed'
        copies = []
        for entry in POLICY['tests']:
            original = safe_relative(packet, entry['source'])
            target = safe_relative(source, entry['target'])
            assert digest(original) == entry['sha256']
            assert not target.exists() and not target.is_symlink(), 'Range initialization: preserve ' + entry['target']
            copies.append((original, target))
        for operation in ['check', 'apply']:
            argv = ['git', 'apply', *(['--check'] if operation == 'check' else []), str(patch)]
            result = subprocess.run(argv, cwd=source, capture_output=True, timeout=POLICY['gitTimeoutSeconds'])
            (proof / (operation + '.stdout.log')).write_bytes(result.stdout)
            (proof / (operation + '.stderr.log')).write_bytes(result.stderr)
            record['commands'].append({'argv': argv, 'exitCode': result.returncode})
            assert result.returncode == 0, 'Range initialization: git ' + operation + ' failed'
        check_inputs(source, declaration['candidateInputs'])
        for original, target in copies:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(original.read_bytes())
            assert digest(target) == digest(original)
        record['prepared'] = True
    except Exception as error:
        record['failure'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        record.update(identity(source))
        if record['sourceCommit'] != POLICY['baseCommit'] or record['sourceGitErrors']:
            record['prepared'] = False
        save(proof / 'preparation.json', record)
    assert record['prepared']
    return record


def qualify(repository, source, proof, node):
    """Build real code and run behavior, public integrations and memory with the selected SDK."""
    repository, source, proof, node = [filename.resolve(strict=True) for filename in [repository, source, proof, node]]
    assert (source / '.git').is_dir() and not (source / '.git').is_symlink()
    prepared = json.loads((proof / 'preparation.json').read_bytes())
    assert prepared['prepared'] and prepared['sourceCommit'] == POLICY['baseCommit']
    assert not (proof / 'qualification.json').exists(), 'Range initialization: preserve qualification'
    declaration = inputs(repository)
    check_inputs(source, declaration['candidateInputs'])
    initial = identity(source)
    assert initial['sourceCommit'] == POLICY['baseCommit'] and not initial['sourceGitErrors']
    assert initial['sourceChangesRaw'] == prepared['sourceChangesRaw'], 'Range initialization: prepared checkout changed'
    for entry in POLICY['tests']:
        assert digest(safe_relative(source, entry['target'])) == entry['sha256']
    command_file = safe_relative(repository, POLICY['command']['path'])
    command_bytes = command_file.read_bytes()
    assert hashlib.sha256(command_bytes).hexdigest() == POLICY['command']['sha256']
    namespace = {'__file__': str(command_file), '__name__': 'range_initialization_current_command'}
    exec(compile(command_bytes, str(command_file), 'exec'), namespace)
    logs = proof / 'logs'; logs.mkdir()
    npm = next((node.parent / relative for relative in POLICY['npmCliCandidates'] if (node.parent / relative).is_file()), None)
    assert npm is not None, 'Range initialization: bundled npm CLI missing beside SDK'
    environment = dict(os.environ, PATH=str(node.parent) + os.pathsep + os.environ.get('PATH', ''),
                       RUSTDOM_RANGE_INITIALIZATION_SOURCE=str(source), RUSTUP_TOOLCHAIN=POLICY['rustToolchain'])
    before_reports = {filename.relative_to(source / 'reports').as_posix(): digest(filename)
                      for filename in (source / 'reports').rglob('*') if filename.is_file()}
    record = {'revision': POLICY['revision'], 'qualified': False, 'commands': [], 'platform': sys.platform,
              'nodeBinarySha256': digest(node), 'sourceBeforeQualification': initial,
              'runtimeIntegrated': False, 'benchmarkExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False}

    def run(label, argv):
        result = namespace['run_command'](label, argv, source, environment, logs,
                                          POLICY['commandTimeoutSeconds'], POLICY['cleanupTimeoutSeconds'])
        record['commands'].append(result)
        save(proof / 'qualification.json', record)
        print(json.dumps({'label': label, 'exitCode': result['exitCode']}), flush=True)
        assert result['exitCode'] == 0 and not result['timedOut'], 'Range initialization qualification failed: ' + label

    try:
        run('node-version', [node, '--version'])
        record['node'] = (logs / 'node-version.stdout.log').read_text(encoding='utf-8').strip()
        assert record['node'] in POLICY['nodes']
        run('rust-version', ['rustc', '--version'])
        assert (logs / 'rust-version.stdout.log').read_text(encoding='utf-8').startswith('rustc ' + POLICY['rustToolchain'] + ' ')
        run('format', ['cargo', 'fmt', '--check'])
        run('dependencies', [node, npm, 'ci', '--no-audit', '--no-fund'])
        run('rust-tests', ['cargo', 'test', '--release', '--locked', '--lib'])
        run('native-build', [node, 'scripts/build-native.mjs'])
        run('clippy', ['cargo', 'clippy', '--all-targets', '--release', '--locked', '--', '-D', 'warnings'])
        run('js-build', [node, 'scripts/build.mjs'])
        native_build = json.loads((source / 'dist/native-build.json').read_bytes())
        assert digest(source / 'dist/rustdom.node') == native_build['binarySha256']
        record['nativeBuild'] = native_build
        run('public', [node, '--expose-gc', '--test', '--test-concurrency=1', source / POLICY['publicTest']])
        consumers = source / '.cache/range-initialization-consumers'
        run('types', [node, source / 'node_modules/typescript/bin/tsc', '--strict', '--module', 'NodeNext',
                      '--target', 'ES2022', '--esModuleInterop', '--skipLibCheck', 'false', '--types', 'node',
                      '--rootDir', source, '--outDir', consumers, source / POLICY['typedConsumer']])
        run('consumer', [node, consumers / 'tests/consumers/range-initialization.cjs'])
        for suite in POLICY['suites']:
            run(suite.replace(':', '-'), [node, npm, 'run', suite])
        run('memory', [node, '--expose-gc', 'tests/helpers/range-state-memory.cjs'])
        check_inputs(source, declaration['candidateInputs'])
        assert digest(source / 'dist/rustdom.node') == native_build['binarySha256']
        record['qualified'] = True
    except Exception as error:
        record['failure'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        record.update(identity(source))
        if record['sourceCommit'] != POLICY['baseCommit'] or record['sourceGitErrors']:
            record['qualified'] = False
        for filename in (source / 'reports').rglob('*'):
            if filename.is_file():
                relative = filename.relative_to(source / 'reports').as_posix()
                if digest(filename) != before_reports.get(relative):
                    target = proof / 'reports' / relative
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(filename.read_bytes())
        save(proof / 'qualification.json', record)
    assert record['qualified'], 'Range initialization: final source provenance failed'
    return record


if __name__ == '__main__':
    assert len(sys.argv) in [5, 6], 'Provide --prepare/--qualify, repository, source, proof, and Node for qualification'
    operation, repository, source, proof = sys.argv[1:5]
    if operation == '--prepare':
        assert len(sys.argv) == 5
        result = prepare(*map(Path, [repository, source, proof]))
    else:
        assert operation == '--qualify' and len(sys.argv) == 6
        result = qualify(*map(Path, [repository, source, proof, sys.argv[5]]))
    print(json.dumps({key: result[key] for key in ['revision', 'runtimeIntegrated', 'performanceAccepted', 'gateReevaluated']}))
