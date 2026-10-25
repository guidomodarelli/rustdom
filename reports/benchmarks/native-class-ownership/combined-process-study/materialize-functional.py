"""Read fixed authenticated data; optional derived code is copied only for byte verification, never executed."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

METHOD = Path(__file__).resolve().parent
REPOSITORY = METHOD.parents[3]


def extract(destination, derived_only=False, log_only=False):
    """Copy fixed recorded data to a new disjoint directory without rewriting any original paths or identities."""
    policy = json.loads((METHOD / 'constants/portable.json').read_bytes())
    archive = REPOSITORY / policy['qualificationArchive']['path']
    manifest_path = REPOSITORY / policy['qualificationManifest']['path']
    assert hashlib.sha256(manifest_path.read_bytes()).hexdigest() == policy['qualificationManifest']['sha256']
    manifest = json.loads(manifest_path.read_bytes())
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == policy['qualificationArchive']['sha256']
    assert archive.stat().st_size == policy['qualificationArchive']['bytes']
    destination = destination.parent.resolve(strict=True) / destination.name
    assert not destination.exists() and not destination.is_symlink(), 'Combined data transport: preserve existing output'
    assert not destination.is_relative_to(REPOSITORY) and not REPOSITORY.is_relative_to(destination)
    assert not (derived_only and log_only)
    prefix = policy['qualificationDerivationPrefix'] if derived_only else policy['qualificationPrefix']
    expected = {name: value for name, value in manifest['files'].items()
                if (name in policy['parentLogFiles'] if log_only else name.startswith(prefix))}
    assert len(expected) == (len(policy['parentLogFiles']) if log_only else
                             policy['qualificationDerivationFiles'] if derived_only else policy['qualificationDataFiles'])
    with zipfile.ZipFile(archive) as source:
        assert set(source.namelist()) == set(manifest['files']) and len(source.namelist()) == len(manifest['files'])
        destination.mkdir()
        for name, identity in expected.items():
            relative = Path(policy['parentLogFiles'][name]) if log_only else Path(name).relative_to(prefix)
            assert not relative.is_absolute() and '..' not in relative.parts and ':' not in name
            data = source.read(name)
            assert len(data) == identity['bytes'] and hashlib.sha256(data).hexdigest() == identity['sha256']
            output = destination / relative; output.parent.mkdir(parents=True, exist_ok=True)
            with output.open('xb') as stream:
                stream.write(data)
    return {'files': len(expected), 'originalDataUnmodified': True, 'archivedCodeExtracted': derived_only, 'archivedCodeExecuted': False,
            'samplerInvoked': False, 'performanceAccepted': None, 'gateReevaluated': False}


if __name__ == '__main__':
    if sys.flags.optimize:
        raise RuntimeError('Combined data transport requires non-optimized Python')
    derived_only = len(sys.argv) == 3 and sys.argv[1] == '--derived'
    log_only = len(sys.argv) == 3 and sys.argv[1] == '--parent-log'
    assert len(sys.argv) == 2 or derived_only or log_only, 'Provide [--derived|--parent-log] and a new disjoint data output directory'
    print(json.dumps(extract(Path(sys.argv[-1]), derived_only, log_only)))
