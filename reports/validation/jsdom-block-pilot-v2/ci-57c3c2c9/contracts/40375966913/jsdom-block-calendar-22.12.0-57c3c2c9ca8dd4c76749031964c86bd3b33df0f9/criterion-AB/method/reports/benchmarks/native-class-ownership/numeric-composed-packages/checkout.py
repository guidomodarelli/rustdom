"""Hydrate only the reviewed package inputs in an existing clean non-cone sparse Git checkout."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Sparse package preparation requires non-optimized Python')

SOURCE = Path(__file__).resolve().parent
SETTINGS = json.loads((SOURCE / 'constants/ci.json').read_bytes())

def git(repository, *arguments, input_bytes=None):
    result = subprocess.run(['git', '-c', 'core.longpaths=true', *arguments], cwd=repository,
        input=input_bytes, capture_output=True, timeout=SETTINGS['gitTimeoutSeconds'])
    if result.returncode:
        raise RuntimeError('Numeric package Git preparation failed (' + arguments[0] + '): ' + result.stderr.decode(errors='replace'))
    return result.stdout

def checked_relative(relative):
    path = PurePosixPath(relative)
    if (not relative or path.is_absolute() or any(part in ['.', '..', '.git'] for part in relative.split('/'))
            or any(character in relative for character in ['\\', ':', '\n', '\r', '\0'])):
        raise ValueError('Numeric package input must be a repository-relative physical file: ' + repr(relative))
    return relative

def pinned_json(repository, binding):
    path = repository / checked_relative(binding['path'])
    assert path.is_file() and not path.is_symlink()
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == binding['sha256']
    return json.loads(raw)

def required(repository):
    """Derive data paths from independently pinned manifests; never import source or execute archive members."""
    policy = json.loads((SOURCE / 'constants/package.json').read_bytes())
    frozen = pinned_json(repository, policy['readerGraph'])
    assert len(frozen['files']) == policy['readerGraph']['files']
    paths = set(frozen['files'])
    paths.add(policy['readerGraph']['path'])
    paths.add(policy['hostedReader']['path'])
    paths.add(policy['inputs']['path'])
    paths.update(binding['path'] for binding in policy['hostedInputs'])
    paths.update(policy['artifactDirectory'] + '/' + name for name in SETTINGS['artifactFiles'])
    transport = json.loads((SOURCE / 'constants/transport.json').read_bytes())
    archive_binding = {'path': transport['archivePolicy']['manifestPath'], 'sha256': transport['archivePolicy']['manifestSha256']}
    archive = pinned_json(repository, archive_binding)
    paths.add(archive_binding['path'])
    paths.add((PurePosixPath(archive_binding['path']).parent / archive['archive']['path']).as_posix())
    tool_root = repository / checked_relative(SETTINGS['tools'])
    for member in tool_root.rglob('*'):
        if '__pycache__' in member.parts:
            continue
        assert not member.is_symlink()
        if member.is_file():
            paths.add(member.relative_to(repository).as_posix())
    return sorted(checked_relative(relative) for relative in paths)

def populate(repository, relatives):
    """Add exact file patterns, preserving the initial checkout and refusing foreign dirty state."""
    repository = repository.resolve(strict=True)
    assert Path(git(repository, 'rev-parse', '--show-toplevel').decode().strip()).resolve(strict=True) == repository
    if git(repository, 'status', '--porcelain=v1', '--untracked-files=normal'):
        raise RuntimeError('Numeric package sparse preparation requires a clean checkout; foreign changes preserved')
    assert git(repository, 'config', '--bool', 'core.sparseCheckout').strip() == b'true'
    assert git(repository, 'config', '--bool', '--default=false', 'core.sparseCheckoutCone').strip() == b'false'
    if git(repository, 'config', '--bool', 'core.autocrlf').strip() != b'false':
        raise RuntimeError('Numeric package sparse preparation requires core.autocrlf=false for exact source bytes')
    relatives = sorted(set(checked_relative(relative) for relative in relatives))
    patterns = []
    for relative in relatives:
        escaped = ''.join('\\' + character if character in '*?[]!#' else character for character in relative)
        patterns.append('/' + escaped)
    git(repository, 'sparse-checkout', 'add', '--stdin', input_bytes=('\n'.join(patterns) + '\n').encode())
    for relative in relatives:
        path = repository / relative
        assert path.is_file() and not path.is_symlink() and path.resolve(strict=True).is_relative_to(repository), relative
    assert git(repository, 'status', '--porcelain=v1', '--untracked-files=normal') == b''
    return {'prepared': True, 'head': git(repository, 'rev-parse', 'HEAD').decode().strip(),
            'requestedFiles': len(relatives), 'runtimeExecuted': False, 'benchmarkExecuted': False}

if __name__ == '__main__':
    assert len(sys.argv) == 2, 'Provide clean non-cone sparse repository'
    repository = Path(sys.argv[1]).resolve(strict=True)
    print(json.dumps(populate(repository, required(repository)), indent=2))
