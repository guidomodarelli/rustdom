"""Bounded streaming reads of already-authenticated original tar data; never import captured code."""
import hashlib
import json
import tarfile
from pathlib import Path


def digest(filename):
    checksum = hashlib.sha256()
    with Path(filename).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1_048_576), b''):
            checksum.update(chunk)
    return checksum.hexdigest()


def read_member(archive, member, limit):
    if not member.isfile() or member.size > limit:
        raise ValueError('Owner batch export: invalid or oversized JSON member ' + member.name)
    with archive.extractfile(member) as stream:
        raw = stream.read(limit + 1)
    if len(raw) != member.size or len(raw) > limit:
        raise ValueError('Owner batch export: truncated JSON member ' + member.name)
    return raw


def read_index(record, root, limit):
    filename = Path(record['archive'])
    if filename.stat().st_size != record['bytes'] or digest(filename) != record['sha256']:
        raise ValueError('Owner batch export: original tar changed before index read')
    result = None
    with tarfile.open(filename, 'r|xz') as archive:
        for member in archive:
            if member.name == root + '/index.json':
                if result is not None:
                    raise ValueError('Owner batch export: duplicate index member')
                result = json.loads(read_member(archive, member, limit))
    if result is None:
        raise ValueError('Owner batch export: original index is missing')
    return result


def reports(record, root, index, limit):
    expected = {root + '/' + entry['directory'] + '/report.json': (sequence, entry) for sequence, entry in enumerate(index['processes'])}
    if len(expected) != len(index['processes']):
        raise ValueError('Owner batch export: duplicate process report path')
    seen = set()
    with tarfile.open(record['archive'], 'r|xz') as archive:
        for member in archive:
            if member.name not in expected:
                continue
            if member.name in seen:
                raise ValueError('Owner batch export: duplicate report member ' + member.name)
            seen.add(member.name)
            raw = read_member(archive, member, limit)
            sequence, process = expected[member.name]
            metadata = process['files']['report.json']
            if len(raw) != metadata['bytes'] or hashlib.sha256(raw).hexdigest() != metadata['sha256']:
                raise ValueError('Owner batch export: original report differs from its validated index')
            yield sequence, process, json.loads(raw)
    if seen != set(expected):
        raise ValueError('Owner batch export: report coverage is incomplete')
    if digest(record['archive']) != record['sha256']:
        raise ValueError('Owner batch export: original tar changed during table export')
