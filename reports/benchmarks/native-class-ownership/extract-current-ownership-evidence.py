"""Authenticate the published original ZIP and reuse its reviewed bounded extractor, without executing archived code."""
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Current ownership evidence extraction requires non-optimized Python')


def digest(source):
    result = hashlib.sha256()
    with source.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def extract(packet, output):
    """Write only under a new output owner and compare every member with the fixed original manifest."""
    policy = json.loads((Path(__file__).resolve().parent / 'constants/current-ownership-evidence.json').read_text())
    for filename, expected in [
        ('artifact.zip', policy['zipSha256']),
        ('raw-members.json.gz', policy['memberManifestSha256']),
        ('extract-current-ownership-result.py', policy['extractorSha256']),
    ]:
        if digest(packet / filename) != expected:
            raise ValueError('Current ownership evidence: changed published input ' + filename)
    output = output.parent.resolve(strict=True) / output.name
    output.mkdir()
    transport = output / policy['archiveMember']
    with zipfile.ZipFile(packet / 'artifact.zip') as archive:
        if archive.namelist() != [policy['archiveMember']]:
            raise ValueError('Current ownership evidence: unexpected original ZIP entries')
        transport.write_bytes(archive.read(policy['archiveMember']))
    if digest(transport) != policy['tarSha256']:
        raise ValueError('Current ownership evidence: changed original tar')
    spec = importlib.util.spec_from_file_location('reviewed_ownership_extractor', packet / 'extract-current-ownership-result.py')
    extractor = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(extractor)
    members = extractor.extract_archive(transport, output / 'archive', {policy['archivePrefix']})
    expected = json.loads(gzip.decompress((packet / 'raw-members.json.gz').read_bytes()))
    if members != expected:
        raise ValueError('Current ownership evidence: extracted members differ from the complete original manifest')
    return {'transportAuthenticated': True, 'members': len(members),
        'regularFiles': sum(member['kind'] == 'file' for member in members),
        'rawRegularBytes': sum(member.get('bytes', 0) for member in members),
        'samplerExecuted': False}


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise ValueError('Current ownership evidence: provide the published packet and a new extraction directory')
    print(json.dumps(extract(Path(sys.argv[1]), Path(sys.argv[2]))))
