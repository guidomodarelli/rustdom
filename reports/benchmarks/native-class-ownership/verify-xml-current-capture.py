"""Verify the original full-input XML capture without executing DOM, GC or measurements."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('xml_observations', ROOT / 'verify-xml-observations.py')
OBSERVATIONS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(OBSERVATIONS)


def digest(filename):
    return hashlib.sha256(filename.read_bytes()).hexdigest()


def verify(capture_root, preparation_root, node='node'):
    """Check real prepared files, observed before/after inputs, resource proof and every timing.

    Transport authentication and current-source eligibility remain separate. This
    verifier must never approve reuse just because a recorded experiment passed.
    """
    capture_root, preparation_root = capture_root.resolve(), preparation_root.resolve()
    functional_path = capture_root.parent / 'functional.json'
    script = """
const fs = require('node:fs');
const preparation = require(process.argv[1]);
const identity = preparation.verify(process.argv[2]);
const report = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const functional = preparation.verifyFunctionalReport(report, identity);
process.stdout.write(JSON.stringify({identity, functional}));
"""
    child = subprocess.run([node, '-e', script, str(ROOT / 'prepare-xml-hosted-build.cjs'),
                            str(preparation_root), str(functional_path)], capture_output=True,
                           text=True, encoding='utf8', timeout=OBSERVATIONS.POLICY['preparationTimeoutSeconds'])
    if child.returncode:
        raise RuntimeError(f"XML archive preparation/resource verification failed: {child.stderr[:OBSERVATIONS.POLICY['diagnosticLimitUnits']]}")
    identity = json.loads(child.stdout)['identity']
    functional = json.loads(child.stdout)['functional']
    preparation_path = preparation_root / 'index.json'
    preparation = json.loads(preparation_path.read_text(encoding='utf8'))
    execution = json.loads((capture_root / 'execution.json').read_text(encoding='utf8'))
    before = execution['before']
    assert execution['complete'] is True and execution['measurementExecuted'] is True
    assert execution['after'] == before
    assert execution['revision'] == before['revision'] == OBSERVATIONS.POLICY['captureRevision']
    assert before['measurementExecuted'] is False and before['performanceAccepted'] is None
    assert before['preparationId'] == identity['preparationId'] == preparation['preparationId']
    assert before['preparationIndexSha256'] == digest(preparation_path)
    assert before['inputs'] == identity['inputs']
    assert before['sources'] == preparation['sourceProvenance']
    assert before['node'] == preparation['tools']['node']
    assert functional['node'] == before['node']
    assert before['runtime']['executableSha256'] == preparation['tools']['executableSha256']
    assert before['runtime']['v8'] == preparation['tools']['v8']
    assert before['runtime']['glibc'] == preparation['settings']['glibc']
    assert before['compiler'] == preparation['tools']['tools']['rustc']['stdout']
    for label, physical in [('A', 'A0'), ('B', 'B')]:
        assert before['distributions'][label] == preparation['distributions'][physical]
        assert before['dependencies'][label] == preparation['installedDependencies'][label]
        assert before['sources'][label]['sourceHash'] == before['inputs']['sources'][label]
    observations_root = capture_root / 'observations'
    experiment = json.loads((observations_root / 'experiment.json').read_text(encoding='utf8'))
    assert experiment['node'] == before['node']
    assert experiment['requestedHead'] == before['sources']['B']['sourceCommit']
    assert experiment['affinity'] == OBSERVATIONS.POLICY['affinityCpu']
    assert execution['command'][-2:] == ['--cpu', str(OBSERVATIONS.POLICY['affinityCpu'])]
    assert experiment['baseline'] == before['roots']['A'] and experiment['candidate'] == before['roots']['B']
    for label, key in [('A', 'baseline'), ('B', 'candidate')]:
        package = preparation_root / 'packages' / ('A0' if label == 'A' else 'B')
        assert experiment[key + 'Binary'] == digest(package / 'dist/rustdom.node')
        assert experiment[key + 'Build'] == json.loads((package / 'dist/native-build.json').read_text(encoding='utf8'))
        source = experiment['baselineSourceIdentity' if label == 'A' else 'sourceIdentity']
        assert source == before['sources'][label]
    assert experiment['rustc'] == before['compiler']
    assert experiment['platform'] == preparation['settings']['platform']
    assert experiment['arch'] == preparation['settings']['arch']
    for name, value in before['machine'].items():
        assert experiment[name] == value
    assert experiment['dependencyLockSha256'] == digest(preparation_root / 'sources/package-lock.json')
    assert execution['experimentComplete'] is True
    assert execution['performanceAccepted'] is experiment['accepted']
    assert execution['process']['error'] is None and execution['process']['signal'] is None
    assert execution['process']['exitCode'] == (2 if experiment['accepted'] is None else 0 if experiment['accepted'] else 3)

    def read_bytes(name):
        filename = (observations_root / name).resolve()
        assert filename.is_relative_to(observations_root)
        return filename.read_bytes()

    result = OBSERVATIONS.verify_observations(experiment, read_bytes)
    return {**result, 'recordedInputsVerified': True, 'preparationId': identity['preparationId'],
            'recordedSources': before['inputs']['sources'], 'functional': functional}


if __name__ == '__main__':
    if len(sys.argv) not in (3, 4):
        raise SystemExit('Use verify-xml-current-capture.py CAPTURE PREPARATION [NODE]')
    print(json.dumps(verify(Path(sys.argv[1]), Path(sys.argv[2]), *sys.argv[3:]), indent=2))
