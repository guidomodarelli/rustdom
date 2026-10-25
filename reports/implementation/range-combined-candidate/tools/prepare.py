"""Apply the reviewed combined candidate to an exact clean checkout, preserving real Git provenance."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Combined candidate preparation requires non-optimized Python')

POLICY = json.loads((Path(__file__).parent / 'constants/preparation.json').read_bytes())


def digest(path):
    """Hash original bytes without newline or source-field normalization."""
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_snapshot(source):
    """Read native Git from a real directory and preserve status/error bytes as UTF-8 text."""
    result = {'sourceCommit': None, 'sourceChangesRaw': None, 'sourceGitErrors': []}
    for arguments, field in [(['rev-parse', 'HEAD'], 'sourceCommit'),
                             (['status', '--porcelain', '--untracked-files=all'], 'sourceChangesRaw')]:
        observed = subprocess.run(['git', *arguments], cwd=source, capture_output=True,
                                  timeout=POLICY['gitTimeoutSeconds'])
        if observed.returncode:
            result['sourceGitErrors'].append(observed.stderr.decode('utf-8', errors='replace'))
        else:
            value = observed.stdout.decode('utf-8')
            result[field] = value.strip() if field == 'sourceCommit' else value
    return result


def safe_relative(root, relative):
    """Resolve one declared artifact path inside its root before reading or writing it."""
    path = Path(relative)
    assert not path.is_absolute() and '..' not in path.parts and ':' not in relative
    resolved = (root / path).resolve()
    assert resolved.is_relative_to(root) and resolved != root, relative
    return resolved


def prepare(repository, source, output):
    """Authenticate all inputs before applying the patch and adding the six real behavioral tests."""
    repository = repository.resolve(strict=True)
    source = source.resolve(strict=True)
    output = output.parent.resolve(strict=True) / output.name
    assert source != repository, 'Combined candidate preparation: use a separate clean checkout'
    protected = [source, repository / POLICY['packet'], repository / POLICY['functionalPacket']]
    for directory in protected:
        assert output != directory and not output.is_relative_to(directory) and not directory.is_relative_to(output), \
            'Combined candidate preparation: output overlaps a protected input'
    assert not output.exists() and not output.is_symlink(), 'Combined candidate preparation: preserve existing output'
    assert (source / '.git').is_dir() and not (source / '.git').is_symlink(), \
        'Combined candidate preparation: require a real Git directory in the source filesystem'
    output.mkdir()
    record = {'revision': POLICY['revision'], 'prepared': False, 'sourceCommit': None,
              'sourceChangesRaw': None, 'sourceGitErrors': [], 'commands': [],
              'runtimeIntegrated': False, 'benchmarkExecuted': False,
              'performanceAccepted': None, 'gateReevaluated': False}
    try:
        record.update(git_snapshot(source))
        assert not record['sourceGitErrors'], 'Combined candidate preparation: source Git discovery failed'
        assert record['sourceCommit'] == POLICY['baseCommit'], 'Combined candidate preparation: wrong source commit'
        assert record['sourceChangesRaw'] == '', 'Combined candidate preparation: preserve dirty source checkout'
        record['sourceBeforeChangesRaw'] = record['sourceChangesRaw']
        for identity in [POLICY['sourceManifest'], POLICY['functionalManifest']]:
            assert digest(repository / identity['path']) == identity['sha256'], identity['path']
        manifest = json.loads((repository / POLICY['sourceManifest']['path']).read_bytes())
        functional = json.loads((repository / POLICY['functionalManifest']['path']).read_bytes())
        assert manifest['baseCommit'] == POLICY['baseCommit']
        packet = repository / POLICY['packet']
        patch = packet / 'range-combined.patch'
        assert digest(patch) == manifest['patchSha256'], 'Combined candidate preparation: patch digest mismatch'
        for relative, expected in manifest['sourceBefore'].items():
            target = safe_relative(source, relative)
            assert not target.is_symlink(), relative
            if expected is None:
                assert not target.exists(), relative
            else:
                assert digest(target) == expected, relative
        for relative, expected in manifest['buildInputs'].items():
            assert digest(safe_relative(source, relative)) == expected, relative
        copies = []
        for relative, identity in functional['functional'].items():
            original = safe_relative(repository / POLICY['functionalPacket'], relative)
            assert digest(original) == identity['sha256'], relative
            copies.append((original, safe_relative(source, identity['target']), identity['sha256']))
        interaction = packet / 'interaction.spec.cjs'
        assert digest(interaction) == manifest['interactionTestSha256']
        copies.append((interaction, safe_relative(source, POLICY['interactionTarget']), manifest['interactionTestSha256']))
        for _, target, _ in copies:
            assert not target.exists() and not target.is_symlink(), str(target)
        for label, arguments in [('check', ['apply', '--check', str(patch)]), ('apply', ['apply', str(patch)])]:
            observed = subprocess.run(['git', *arguments], cwd=source, capture_output=True,
                                      timeout=POLICY['gitTimeoutSeconds'])
            (output / (label + '.stdout.log')).write_bytes(observed.stdout)
            (output / (label + '.stderr.log')).write_bytes(observed.stderr)
            record['commands'].append({'argv': ['git', *arguments], 'exitCode': observed.returncode})
            assert observed.returncode == 0, 'Combined candidate preparation: git ' + label + ' failed'
        for relative, expected in manifest['sources'].items():
            assert digest(safe_relative(source, relative)) == expected, relative
        for original, target, expected in copies:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(original.read_bytes())
            assert digest(target) == expected, str(target)
        record.update(git_snapshot(source))
        assert not record['sourceGitErrors'], 'Combined candidate preparation: post-apply Git discovery failed'
        record.update({'prepared': True, 'sourceFiles': manifest['sources'],
                       'copiedTests': {str(target.relative_to(source)): expected for _, target, expected in copies},
                       'patchSha256': manifest['patchSha256']})
    except Exception as error:
        record['failure'] = {'type': type(error).__name__, 'message': str(error)}
        try:
            observed = git_snapshot(source)
            record.update(observed)
        except Exception as snapshot_error:
            record['sourceChangesRaw'] = None
            record['sourceGitErrors'].append(str(snapshot_error))
        raise
    finally:
        (output / POLICY['preparationFile']).write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8', newline='\n')
    return record


if __name__ == '__main__':
    assert len(sys.argv) == 4, 'Provide repository, clean source checkout and new proof directory'
    print(json.dumps(prepare(*map(Path, sys.argv[1:]))))
