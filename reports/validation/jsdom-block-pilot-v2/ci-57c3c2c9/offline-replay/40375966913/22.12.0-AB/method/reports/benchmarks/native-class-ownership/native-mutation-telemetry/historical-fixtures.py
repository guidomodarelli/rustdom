"""Materialize already-published data for reader contracts; never execute archived scripts."""
import hashlib
import gzip
import importlib.util
import json
from pathlib import Path
import shutil
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Native telemetry historical fixtures require non-optimized Python')


def digest(filename):
    result = hashlib.sha256()
    with filename.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def extract(repository, destination):
    policy = json.loads((Path(__file__).parent / 'constants/protocol.json').read_text(encoding='utf-8'))
    packet = repository / 'reports/benchmarks/native-class-ownership/jsdom-telemetry-results/39959175058'
    transport = json.loads((packet / 'transport.json').read_text(encoding='utf-8'))
    assert transport['zipSha256'] == policy['historicalZipSha256']
    assert transport['zipBytes'] == policy['historicalZipBytes']
    destination = destination.parent.resolve(strict=True) / destination.name
    assert not destination.exists(), 'Native telemetry historical fixtures: destination must be fresh'
    working = destination.parent / (destination.name + '-transport')
    working.mkdir()
    archive_path = working / 'artifact.zip'
    with archive_path.open('xb') as archive:
        for part in transport['parts']:
            assert Path(part['name']).name == part['name']
            filename = packet / part['name']
            assert filename.stat().st_size == part['bytes'] and digest(filename) == part['sha256']
            with filename.open('rb') as source:
                shutil.copyfileobj(source, archive, 1024 * 1024)
    assert archive_path.stat().st_size == policy['historicalZipBytes']
    assert digest(archive_path) == policy['historicalZipSha256']
    tar_path = working / 'jsdom-telemetry-results.tar.xz'
    with zipfile.ZipFile(archive_path) as archive:
        assert archive.namelist() == [tar_path.name]
        assert archive.testzip() is None
        with archive.open(tar_path.name) as source, tar_path.open('xb') as output:
            shutil.copyfileobj(source, output, 1024 * 1024)
    assert digest(tar_path) == policy['historicalTarSha256']
    helper = packet / 'tools/extract-current-ownership-result.py'
    spec = importlib.util.spec_from_file_location('reviewed_safe_archive_extractor', helper)
    reader = importlib.util.module_from_spec(spec); spec.loader.exec_module(reader)
    members = reader.extract_archive(tar_path, destination, {'jsdom-telemetry'})
    (working / 'members.json.gz').write_bytes(gzip.compress((json.dumps(members, indent=2) + '\n').encode(), mtime=0))
    return {'historicalRunId': 39959175058, 'root': str(destination / 'jsdom-telemetry/capture'),
        'members': len(members), 'DOMExecuted': False, 'newMeasurements': 0,
        'zipSha256': digest(archive_path), 'tarSha256': digest(tar_path)}


if __name__ == '__main__':
    assert len(sys.argv) == 3, 'Provide repository and fresh destination for historical data only'
    print(json.dumps(extract(*map(Path, sys.argv[1:]))))
