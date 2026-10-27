"""Observe or preserve only the pinned run using current authenticated transport code; never activate or execute DOM."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import types

if sys.flags.optimize:
    raise RuntimeError('Range study transport requires non-optimized Python')

POLICY = json.loads((Path(__file__).parent / 'constants/transport.json').read_text(encoding='utf-8'))


def current_reader(repository):
    """Configure the existing reviewed reader with this run's immutable identity; no code comes from an archive."""
    if any(type(POLICY[name]) is not int or POLICY[name] <= 0 for name in ['runId', 'jobId']) or POLICY['attempt'] != 1:
        raise RuntimeError('Range AA transport: bind the actual run and job before observing')
    filename = repository / POLICY['sourceReaderPath']
    content = filename.read_bytes()
    assert hashlib.sha256(content).hexdigest() == POLICY['sourceReaderSha256']
    module = types.ModuleType('current_range_study_transport')
    module.__file__ = str(filename)
    exec(compile(content, str(filename), 'exec'), module.__dict__)
    module.POLICY = dict(POLICY)
    for attribute, field in [('RUN_ID', 'runId'), ('JOB_ID', 'jobId'), ('HEAD', 'head'), ('WORKFLOW', 'workflow'),
                             ('ARTIFACT_NAME', 'artifactName'), ('TAR_NAME', 'tarName')]:
        setattr(module, attribute, POLICY[field])
    return module


def preserve_snapshot(output, completed):
    """Keep every successful or partial observation; never write to a foreign output or shared authorization state."""
    if output.is_symlink() or getattr(output, 'is_junction', lambda: False)():
        return
    marker = output / POLICY['ownerFile']
    expected = {'collector': POLICY['collectorRevision'], 'runId': POLICY['runId'], 'jobId': POLICY['jobId'],
                'head': POLICY['head'], 'attempt': POLICY['attempt']}
    if not marker.is_file() or marker.is_symlink() or json.loads(marker.read_bytes()) != expected:
        return
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    history = output / 'observations'
    assert not history.is_symlink() and not getattr(history, 'is_junction', lambda: False)()
    destination = history / stamp
    destination.mkdir(parents=True)
    for name in ['run.json', 'jobs.json', 'artifacts.json', 'observation.json', 'collection.json']:
        source = output / name
        if source.is_file():
            shutil.copyfile(source, destination / name)
    with (destination / 'reader.json').open('x', encoding='utf-8') as record:
        json.dump({'readerCompleted': completed, 'readerExecutedDOM': False, 'sharedWatchModified': False}, record)
        record.write('\n')


def collect(repository, output, download=False):
    """Read the same run/job even after PR pushes; the moving pull-request reference never defines the source."""
    repository = repository.resolve(strict=True)
    output = output.parent.resolve(strict=True) / output.name
    reader = current_reader(repository)
    original_repository = os.environ.get('GH_REPO')
    os.environ['GH_REPO'] = POLICY['repository']
    completed = False
    try:
        state = reader.collect(repository, output, download)
        completed = True
        return state
    finally:
        if original_repository is None:
            os.environ.pop('GH_REPO', None)
        else:
            os.environ['GH_REPO'] = original_repository
        preserve_snapshot(output, completed)


if __name__ == '__main__':
    assert len(sys.argv) in [3, 4], 'Provide repository, owned collection, and optional --collect'
    assert len(sys.argv) != 4 or sys.argv[3] == '--collect'
    print(json.dumps(collect(Path(sys.argv[1]), Path(sys.argv[2]), len(sys.argv) == 4)))
