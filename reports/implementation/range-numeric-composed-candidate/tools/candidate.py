"""Specialize authenticated current preparation tools for the composed numeric candidate."""
import sys
if sys.flags.optimize:
    raise RuntimeError('Composed numeric candidate tools require non-optimized Python')
import hashlib
import json
import os
from pathlib import Path

POLICY = json.loads((Path(__file__).parent / 'constants/candidate.json').read_bytes())


def context(repository):
    """Compile the declared current helper bytes; never import an archived tool or a cached module."""
    filename = repository / POLICY['sharedTool']['path']
    raw = filename.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == POLICY['sharedTool']['sha256']
    namespace = {'__file__': str(filename), '__name__': 'range_numeric_current_tool'}
    exec(compile(raw, str(filename), 'exec'), namespace)
    namespace['POLICY'] = POLICY
    return namespace


def qualify(repository, source, proof, node):
    """Keep suite qualification and raw collapse evidence separate, accepting only their complete conjunction."""
    repository, source, proof, node = [filename.resolve(strict=True) for filename in [repository, source, proof, node]]
    api = context(repository)
    output = api['safe_relative'](proof, POLICY['completeFile'])
    assert not output.exists() and not output.is_symlink(), 'Composed candidate: preserve complete qualification'
    record = {'revision': POLICY['revision'], 'qualified': False, 'suiteQualificationComplete': False,
              'collapseEvidenceComplete': False, 'runtimeIntegrated': False,
              'benchmarkExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False}
    api['save'](output, record)
    previous = os.environ.pop(POLICY['memoryOutputEnvironment'], None)
    try:
        # test:compat discovers these tests again. Never share a single exclusive output path across suites.
        suites = api['qualify'](repository, source, proof, node)
        assert suites['qualified']
        record['suiteQualificationComplete'] = True
        record['suiteReceipt'] = 'qualification.json'
        record['nativeBinarySha256'] = suites['nativeBuild']['binarySha256']
        log_directory = api['safe_relative'](proof, POLICY['memoryLogDirectory'])
        log_directory.mkdir()
        command_file = api['safe_relative'](repository, POLICY['command']['path'])
        command_bytes = command_file.read_bytes()
        assert hashlib.sha256(command_bytes).hexdigest() == POLICY['command']['sha256']
        command_api = {'__file__': str(command_file), '__name__': 'range_numeric_memory_command'}
        exec(compile(command_bytes, str(command_file), 'exec'), command_api)
        environment = dict(os.environ, PATH=str(node.parent) + os.pathsep + os.environ.get('PATH', ''))
        command = command_api['run_command']('collapse-memory',
            [node, '--expose-gc', source / POLICY['memoryHelper']], source, environment, log_directory,
            POLICY['commandTimeoutSeconds'], POLICY['cleanupTimeoutSeconds'])
        record['memoryCommand'] = command
        assert command['exitCode'] == 0 and not command['timedOut'], 'Composed candidate: collapse memory probe failed'
        memory = json.loads((log_directory / 'collapse-memory.stdout.log').read_bytes())
        assert memory['pass'] and len(memory['cycles']) == POLICY['memoryCycles']
        api['check_inputs'](source, api['inputs'](repository)['candidateInputs'])
        assert api['digest'](source / 'dist/rustdom.node') == record['nativeBinarySha256']
        record['collapseEvidenceComplete'] = True
        record['qualified'] = True
    except Exception as error:
        record['failure'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        if previous is not None:
            os.environ[POLICY['memoryOutputEnvironment']] = previous
        record.update(api['identity'](source))
        if record['sourceGitErrors'] or record['sourceCommit'] != POLICY['baseCommit']:
            record['qualified'] = False
        api['save'](output, record)
    assert record['qualified'], 'Composed candidate: final source provenance failed'
    return record


if __name__ == '__main__':
    assert len(sys.argv) in [5, 6], 'Provide --prepare/--qualify, current repository, source, proof and Node for qualification'
    operation = sys.argv[1]
    repository, source, proof = map(Path, sys.argv[2:5])
    api = context(repository.resolve(strict=True))
    if operation == '--prepare':
        assert len(sys.argv) == 5
        result = api['prepare'](repository, source, proof)
    else:
        assert operation == '--qualify' and len(sys.argv) == 6
        result = qualify(repository, source, proof, Path(sys.argv[5]))
    print(json.dumps({key: result[key] for key in ['revision', 'runtimeIntegrated', 'performanceAccepted', 'gateReevaluated']}))
