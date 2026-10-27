"""Build tiny invalid tar inputs for real decoder behavior tests, never DOM timings."""
import hashlib
import io
import json
import pathlib
import sys
import tarfile


def create(directory_argument, case):
    """Write only inside a caller-owned fixture directory; unsafe paths stay in headers."""
    directory = pathlib.Path(directory_argument)
    assert directory.is_dir() and not any(directory.iterdir())
    prefix = 'contract-evidence'
    payload = b'payload'
    name = prefix + '/payload.txt'
    member = tarfile.TarInfo(name)
    member.size = len(payload)
    expected = {'payload.txt': {'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()}}
    members = [(member, payload)]
    if case == 'traversal':
        member.name = prefix + '/../escaped.txt'
    elif case == 'symbolic-link':
        member.type = tarfile.SYMTYPE
        member.linkname = '../../escaped.txt'
        member.size = 0
        expected['payload.txt'] = {'bytes': 0, 'sha256': hashlib.sha256(b'').hexdigest()}
        members = [(member, b'')]
    elif case == 'hard-link':
        member.type = tarfile.LNKTYPE
        member.linkname = '../../escaped.txt'
        member.size = 0
        expected['payload.txt'] = {'bytes': 0, 'sha256': hashlib.sha256(b'').hexdigest()}
        members = [(member, b'')]
    elif case == 'duplicate':
        members.append((member, payload))
    elif case == 'undeclared':
        member.name = prefix + '/undeclared.txt'
    elif case == 'digest-mismatch':
        expected['payload.txt']['sha256'] = hashlib.sha256(b'other payload').hexdigest()
    else:
        raise ValueError('Unknown recorded-evidence contract case: ' + case)
    with tarfile.open(directory / 'fixture.tar.gz', 'w:gz') as archive:
        for entry, content in members:
            archive.addfile(entry, io.BytesIO(content))
    (directory / 'raw-files.json').write_text(json.dumps(expected) + '\n', encoding='utf-8')
    print(json.dumps({'prefix': prefix, 'case': case}))


if __name__ == '__main__':
    create(*sys.argv[1:])
