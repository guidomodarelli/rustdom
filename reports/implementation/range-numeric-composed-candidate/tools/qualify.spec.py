"""Regress exclusive-output collisions by running the complete real qualifier with a protected inherited destination."""
import sys
if sys.flags.optimize:
    raise RuntimeError('Qualification regression requires non-optimized Python')
import json
import os
from pathlib import Path
from candidate import POLICY, context, qualify


def run(repository, source, proof, node):
    """Exercise actual builds, suites, subprocesses and memory; protect caller state even after failure."""
    repository, source, proof, node = [filename.resolve(strict=True) for filename in [repository, source, proof, node]]
    api = context(repository)
    sentinel = api['safe_relative'](proof, POLICY['regressionSentinelFile'])
    receipt = api['safe_relative'](proof, POLICY['regressionReceiptFile'])
    assert not sentinel.exists() and not receipt.exists(), 'Qualification regression: preserve prior evidence'
    payload = b'{"preservedCallerOutput": true}\n'
    with sentinel.open('xb') as stream:
        stream.write(payload)
    environment_key = POLICY['memoryOutputEnvironment']
    previous = os.environ.get(environment_key)
    os.environ[environment_key] = str(sentinel)
    record = {'pass': False, 'callerOutputPreserved': False, 'callerEnvironmentRestored': False,
              'runtimeIntegrated': False, 'performanceAccepted': None, 'gateReevaluated': False}
    try:
        result = qualify(repository, source, proof, node)
        assert result['qualified'] and result['suiteQualificationComplete'] and result['collapseEvidenceComplete']
        assert sentinel.read_bytes() == payload, 'Qualification regression: inherited output was overwritten'
        assert os.environ.get(environment_key) == str(sentinel), 'Qualification regression: caller environment changed'
        record.update({'pass': True, 'callerOutputPreserved': True, 'callerEnvironmentRestored': True})
    except Exception as error:
        record['failure'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        if previous is None:
            os.environ.pop(environment_key, None)
        else:
            os.environ[environment_key] = previous
        api['save'](receipt, record)
    print(json.dumps(record))


if __name__ == '__main__':
    assert len(sys.argv) == 5, 'Provide current repository, prepared source, proof and actual Node executable'
    run(*map(Path, sys.argv[1:]))
