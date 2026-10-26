"""Create a genuine sparse Git checkout from already hydrated local objects without serving a promisor repository."""
import sys
if sys.flags.optimize:
    raise RuntimeError('Native checkout requires non-optimized Python validation')
from pathlib import Path
import re
import subprocess


def checkout(source, target, revision, patterns, timeout_seconds):
    """Keep source metadata unchanged and use Git itself to materialize the authenticated existing commit."""
    source = source.resolve(strict=True)
    target = target.parent.resolve(strict=True) / target.name
    assert re.fullmatch(r'[0-9a-f]{40}', revision)
    assert (source / '.git').is_dir() and not (source / '.git').is_symlink()
    assert not target.exists() and not target.is_symlink(), 'Native checkout: preserve existing destination'
    assert not target.is_relative_to(source) and not source.is_relative_to(target)
    assert isinstance(patterns, list) and patterns and all(isinstance(pattern, str) for pattern in patterns)

    def git(directory, arguments):
        result = subprocess.run(['git', '-C', str(directory), *arguments], capture_output=True, timeout=timeout_seconds)
        assert result.returncode == 0, result.stderr.decode(errors='replace')
        return result.stdout.decode('utf-8').strip()

    assert git(source, ['rev-parse', 'HEAD']) == revision, 'Native checkout: source HEAD differs from declared commit'
    common = Path(git(source, ['rev-parse', '--git-common-dir']))
    common = common.resolve(strict=True) if common.is_absolute() else (source / common).resolve(strict=True)
    objects = common / 'objects'
    assert objects.is_dir() and not objects.is_symlink()
    assert '\n' not in objects.as_posix() and '\r' not in objects.as_posix()
    created = subprocess.run(['git', 'init', '--quiet', '--object-format=sha1', str(target)],
                             capture_output=True, timeout=timeout_seconds)
    assert created.returncode == 0, created.stderr.decode(errors='replace')
    alternate = target / '.git/objects/info/alternates'
    alternate.write_text(objects.as_posix() + '\n', encoding='utf-8', newline='\n')
    shallow = common / 'shallow'
    if shallow.exists():
        assert shallow.is_file() and not shallow.is_symlink()
        (target / '.git/shallow').write_bytes(shallow.read_bytes())
    promisor = subprocess.run(['git', '-C', str(source), 'config', '--get', 'remote.origin.promisor'],
                              capture_output=True, timeout=timeout_seconds)
    assert promisor.returncode in [0, 1], promisor.stderr.decode(errors='replace')
    if promisor.returncode == 0:
        assert promisor.stdout.decode('utf-8').strip() == 'true'
        # Preserve partial-repository semantics; missing excluded blobs are promised, not corruption.
        for key in ['remote.origin.url', 'remote.origin.partialclonefilter']:
            git(target, ['config', key, git(source, ['config', '--get', key])])
        git(target, ['config', 'remote.origin.promisor', 'true'])
    git(target, ['config', 'core.autocrlf', 'false'])
    git(target, ['sparse-checkout', 'set', '--no-cone', *patterns])
    git(target, ['checkout', '--detach', revision])
    assert (target / '.git').is_dir()
    assert git(target, ['rev-parse', 'HEAD']) == revision
    assert git(target, ['status', '--porcelain', '--untracked-files=all']) == ''
    return target
