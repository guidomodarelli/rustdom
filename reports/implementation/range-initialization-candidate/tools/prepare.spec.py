"""Exercise real Git preparation and rejection/preservation boundaries without fake source modules."""
import json
from pathlib import Path
import shutil
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Preparation contracts require non-optimized Python')
from candidate import POLICY, check_inputs, digest, identity, inputs, prepare


def run(repository, native_source, output):
    """Use fresh real sparse clones; never alter the caller's source checkout."""
    repository, native_source = repository.resolve(strict=True), native_source.resolve(strict=True)
    assert (native_source / '.git').is_dir() and not output.exists()
    output.mkdir()
    results = []

    def checkout(label):
        target = output / label
        for argv in [
            ['git', 'clone', '--shared', '--no-checkout', str(native_source), str(target)],
            ['git', '-C', str(target), 'sparse-checkout', 'set', '--no-cone', '/*', '!/*/', '/src/', '/scripts/',
             '/benchmarks/', '/third-party/', '/types/', '/tests/',
             '/reports/validation/native-class-ownership/ci-macos-timeout/fixture.json.gz',
             '/reports/validation/native-class-ownership/ci-macos-timeout/39686199408/fixture.json.gz',
             '/reports/validation/native-class-ownership/ci-windows-timeout/39894045206/comparison.json.gz'],
            ['git', '-C', str(target), 'checkout', '--detach', POLICY['baseCommit']],
        ]:
            observed = subprocess.run(argv, capture_output=True, timeout=60)
            assert observed.returncode == 0, observed.stderr.decode(errors='replace')
        assert identity(target)['sourceChangesRaw'] == ''
        return target

    good = checkout('good')
    prepared = prepare(repository, good, output / 'good-proof')
    assert prepared['prepared'] and not prepared['sourceGitErrors']
    check_inputs(good, inputs(repository)['candidateInputs'])
    for entry in POLICY['tests']:
        assert digest(good / entry['target']) == entry['sha256']
    results.append('exact-patch-and-behavioral-consumers-copied')
    before = identity(good)
    try:
        prepare(repository, good, output / 'good-proof')
        raise RuntimeError('Existing proof unexpectedly overwritten')
    except AssertionError:
        assert identity(good) == before
    results.append('existing-proof-preserved')

    dirty = checkout('dirty')
    filename = dirty / 'src/dom/range_state_binding.rs'
    filename.write_bytes(filename.read_bytes() + b'\n// foreign uncommitted change\n')
    expected = filename.read_bytes()
    try:
        prepare(repository, dirty, output / 'dirty-proof')
        raise RuntimeError('Dirty source unexpectedly accepted')
    except AssertionError:
        assert filename.read_bytes() == expected
        assert not json.loads((output / 'dirty-proof/preparation.json').read_bytes())['prepared']
    results.append('foreign-source-change-preserved')

    protected = checkout('protected')
    before = identity(protected)
    try:
        prepare(repository, protected, protected / 'nested-proof')
        raise RuntimeError('Overlapping output unexpectedly accepted')
    except AssertionError:
        assert identity(protected) == before and not (protected / 'nested-proof').exists()
    results.append('source-overlap-rejected-before-writing')

    bad_packet = output / 'bad-packet'
    packet = repository / POLICY['packet']
    shutil.copytree(packet, bad_packet / POLICY['packet'])
    for name in [POLICY['inputs']['path']]:
        target = bad_packet / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(repository / name, target)
    changed_patch = bad_packet / POLICY['packet'] / POLICY['patch']['path']
    changed_patch.write_bytes(changed_patch.read_bytes() + b'\n')
    clean = checkout('bad-patch')
    before = identity(clean)
    try:
        prepare(bad_packet, clean, output / 'bad-patch-proof')
        raise RuntimeError('Changed patch unexpectedly applied')
    except AssertionError:
        assert identity(clean) == before
        check_inputs(clean, inputs(repository)['productionInputs'])
    results.append('modified-patch-rejected-before-apply')
    record = {'pass': True, 'contracts': results, 'sourceInputCount': POLICY['compilerInputCount']}
    (output / 'contracts.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps(record))


if __name__ == '__main__':
    assert len(sys.argv) == 4, 'Provide current repository, native source Git checkout, and new contracts output'
    run(*map(Path, sys.argv[1:]))
