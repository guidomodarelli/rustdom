"""Extract pinned regular-file evidence into an empty directory owned by the caller."""
import hashlib
import json
import pathlib
import re
import sys
import tarfile


def normalized_name(value):
    """Reject ambiguous and escaping archive names before creating any files."""
    assert isinstance(value, str) and value and '\\' not in value and ':' not in value
    name = pathlib.PurePosixPath(value)
    assert not name.is_absolute() and '..' not in name.parts and name.parts
    assert name.as_posix() == value, value
    return name


def extract(filename, manifest_filename, prefix, destination_argument):
    """Authenticate every member and permit neither links nor preexisting output."""
    if sys.flags.optimize:
        raise RuntimeError('Recorded evidence: Python optimization disables required checks; unset PYTHONOPTIMIZE')
    settings = json.loads((pathlib.Path(__file__).parent / 'constants/recorded-evidence.json').read_text())
    digest_pattern = re.compile(settings['sha256Pattern'])
    prefix_name = normalized_name(prefix)
    assert len(prefix_name.parts) == 1
    destination = pathlib.Path(destination_argument)
    assert destination.is_dir() and not destination.is_symlink()
    destination = destination.resolve()
    assert not any(destination.iterdir()), 'Recorded evidence: destination must be empty'
    expected = json.loads(pathlib.Path(manifest_filename).read_text(encoding='utf-8'))
    assert isinstance(expected, dict) and expected
    for name, metadata in expected.items():
        normalized_name(name)
        assert isinstance(metadata, dict)
        assert type(metadata['bytes']) is int and metadata['bytes'] >= 0
        assert isinstance(metadata['sha256'], str) and digest_pattern.fullmatch(metadata['sha256'])

    with tarfile.open(filename, 'r:gz') as archive:
        members = archive.getmembers()
        names = set()
        files = {}
        for member in members:
            name = normalized_name(member.name)
            assert name.parts[0] == prefix
            assert member.name not in names, member.name
            names.add(member.name)
            assert member.isfile() or member.isdir(), member.name
            if member.isdir():
                assert member.size == 0, member.name
            if member.isfile():
                relative = name.relative_to(prefix_name).as_posix()
                assert relative in expected, relative
                assert member.size == expected[relative]['bytes'], relative
                files[relative] = member
        assert set(files) == set(expected), 'Recorded evidence: missing or undeclared files'
        file_names = {prefix + '/' + name for name in files}
        for name in names:
            assert not any(parent.as_posix() in file_names
                           for parent in pathlib.PurePosixPath(name).parents), name

        for name, member in files.items():
            target = destination / prefix / name
            assert target.resolve().is_relative_to(destination)
            target.parent.mkdir(parents=True, exist_ok=True)
            digest = hashlib.sha256()
            size = 0
            with archive.extractfile(member) as source, target.open('xb') as output:
                for chunk in iter(lambda: source.read(1 << 20), b''):
                    output.write(chunk)
                    digest.update(chunk)
                    size += len(chunk)
            assert size == expected[name]['bytes'] and digest.hexdigest() == expected[name]['sha256'], name
    return {'verified': True, 'files': len(files), 'prefix': prefix}


if __name__ == '__main__':
    assert len(sys.argv) == 5, 'Recorded evidence: provide archive, manifest, prefix and empty destination'
    print(json.dumps(extract(*sys.argv[1:])))
