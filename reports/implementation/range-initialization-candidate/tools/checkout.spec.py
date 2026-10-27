"""Exercise an offline genuine filtered Git repository, source preservation and native sparse checkout identity."""
import sys
if sys.flags.optimize:
    raise RuntimeError('Native checkout contracts require non-optimized Python')
import json
from pathlib import Path
import subprocess
from checkout import checkout


def run(output):
    """Use real file-protocol filtering and leave every fixture and command diagnostic available for audit."""
    assert not output.exists() and not output.is_symlink()
    output = output.parent.resolve(strict=True) / output.name
    output.mkdir()
    commands = []

    def execute(arguments, expect_success=True):
        result = subprocess.run(list(map(str, arguments)), capture_output=True, timeout=60)
        ordinal = len(commands)
        (output / (str(ordinal) + '.stdout.log')).write_bytes(result.stdout)
        (output / (str(ordinal) + '.stderr.log')).write_bytes(result.stderr)
        commands.append({'argv': list(map(str, arguments)), 'exitCode': result.returncode})
        if expect_success:
            assert result.returncode == 0, result.stderr.decode(errors='replace')
        else:
            assert result.returncode != 0, 'Checkout fixture: excluded object unexpectedly hydrated'
        return result.stdout.decode('utf-8').strip()

    full = output / 'origin'
    execute(['git', 'init', '--quiet', '--initial-branch=main', '--object-format=sha1', full])
    (full / 'src').mkdir(); (full / 'excluded').mkdir()
    payload = b'required fixture data\n'
    (full / 'src/required.txt').write_bytes(b'previous fixture data\n')
    (full / 'excluded/absent.txt').write_bytes(b'unhydrated fixture data\n')
    (full / '.gitattributes').write_bytes(b'* -text\n')
    execute(['git', '-C', full, 'config', 'uploadpack.allowFilter', 'true'])
    execute(['git', '-C', full, 'add', '--', '.gitattributes', 'src/required.txt', 'excluded/absent.txt'])
    execute(['git', '-C', full, '-c', 'user.name=Git fixture', '-c', 'user.email=git-fixture@example.invalid',
             'commit', '--quiet', '-m', 'Create filtered-checkout fixture'])
    (full / 'src/required.txt').write_bytes(payload)
    execute(['git', '-C', full, 'add', '--', 'src/required.txt'])
    execute(['git', '-C', full, '-c', 'user.name=Git fixture', '-c', 'user.email=git-fixture@example.invalid',
             'commit', '--quiet', '-m', 'Update hydrated fixture'])
    revision = execute(['git', '-C', full, 'rev-parse', 'HEAD'])
    excluded = execute(['git', '-C', full, 'rev-parse', 'HEAD:excluded/absent.txt'])
    partial = output / 'partial'
    execute(['git', 'clone', '--no-local', '--no-checkout', '--filter=blob:none', '--depth=1', full.as_uri(), partial])
    patterns = ['/src/', '/.gitattributes']
    execute(['git', '-C', partial, 'sparse-checkout', 'set', '--no-cone', *patterns])
    execute(['git', '-C', partial, 'checkout', '--detach', revision])
    assert list((partial / '.git/objects/pack').glob('*.promisor')), 'Fixture must genuinely use promisor packs'
    before = execute(['git', '-C', partial, 'status', '--porcelain', '--untracked-files=all'])
    configuration_before = (partial / '.git/config').read_bytes()
    shallow_before = (partial / '.git/shallow').read_bytes()
    offline = output / 'offline-origin'
    assert full.resolve().is_relative_to(output) and offline.parent.resolve() == output
    assert not offline.exists()
    full.rename(offline)
    execute(['git', '-C', partial, 'cat-file', '-e', excluded], expect_success=False)
    target = checkout(partial, output / 'native', revision, patterns, 60)
    assert (target / '.git').is_dir() and not (target / '.git').is_symlink()
    assert (target / 'src/required.txt').read_bytes() == payload
    assert not (target / 'excluded/absent.txt').exists()
    assert execute(['git', '-C', target, 'rev-parse', 'HEAD']) == revision
    assert execute(['git', '-C', target, 'config', '--get', 'remote.origin.promisor']) == 'true'
    execute(['git', '-C', target, 'fsck', '--connectivity-only', '--no-dangling'])
    assert execute(['git', '-C', partial, 'status', '--porcelain', '--untracked-files=all']) == before
    assert (partial / '.git/config').read_bytes() == configuration_before
    assert (partial / '.git/shallow').read_bytes() == shallow_before
    assert (target / '.git/shallow').read_bytes() == shallow_before
    execute(['git', '-C', partial, 'cat-file', '-e', excluded], expect_success=False)
    result = {'pass': True, 'genuineFilteredSource': True, 'genuineShallowSource': True, 'originUnavailable': True,
              'excludedObjectStillMissing': True, 'sourceStatusUnchanged': True, 'nativeGitDirectory': True,
              'revision': revision, 'commands': commands}
    (output / 'contracts.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({key: value for key, value in result.items() if key != 'commands'}))


if __name__ == '__main__':
    assert len(sys.argv) == 2, 'Provide a new checkout contract output directory'
    run(Path(sys.argv[1]))
