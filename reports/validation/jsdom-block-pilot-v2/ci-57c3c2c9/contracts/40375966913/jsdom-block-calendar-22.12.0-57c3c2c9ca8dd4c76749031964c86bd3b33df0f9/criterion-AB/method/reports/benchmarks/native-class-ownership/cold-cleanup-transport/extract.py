"""Extract the pinned preparation with the reviewed safe extractor; never execute archived code."""
import gzip
import hashlib
import json
from pathlib import Path
import sys
import types

if sys.flags.optimize:
    raise RuntimeError('Cold preparation extraction requires non-optimized Python')

POLICY = json.loads((Path(__file__).parent / 'constants/transport.json').read_text(encoding='utf-8'))
FILES = POLICY['files']


def extract(repository, collection, destination):
    state = json.loads((collection / FILES['state']).read_text())
    assert state['runId'] == POLICY['runId'] and state['jobId'] == POLICY['jobId']
    assert state['head'] == POLICY['head'] and state['attempt'] == POLICY['attempt']
    assert state['artifactId'] == POLICY['artifactId']
    assert state['status'] == 'completed' and state['transportAuthenticated'] is True
    source = collection / POLICY['tarName']
    def digest(filename):
        result = hashlib.sha256()
        with filename.open('rb') as content:
            for chunk in iter(lambda: content.read(1024 * 1024), b''):
                result.update(chunk)
        return result.hexdigest()
    assert digest(source) == state['tarSha256'] == POLICY['tarSha256']
    assert digest(collection / FILES['zip']) == state['zipSha256'] == POLICY['zipSha256']
    helper = repository / POLICY['extractorPath']
    helper_bytes = helper.read_bytes()
    assert hashlib.sha256(helper_bytes).hexdigest() == POLICY['extractorSha256']
    # Compile those exact verified bytes, bypassing potentially stale .pyc files.
    module = types.ModuleType('reviewed_study_archive_extraction')
    module.__file__ = str(helper)
    exec(compile(helper_bytes, str(helper), 'exec'), module.__dict__)
    members = module.extract_archive(source, destination, {POLICY['rootName']})
    manifest_path = destination.parent / (destination.name + POLICY['suffixes']['members'])
    with manifest_path.open('xb') as output:
        output.write(gzip.compress((json.dumps(members, indent=2) + '\n').encode(), mtime=0))
    result = {'root': str(destination / POLICY['rootName']), 'regularFiles': sum(member['kind'] == 'file' for member in members),
        'members': len(members), 'rawRegularBytes': sum(member.get('bytes', 0) for member in members),
        'links': sum(member['kind'] in ['symlink', 'hardlink'] for member in members),
        'memberManifest': str(manifest_path), 'transportAuthenticated': True, 'extractorExecutedDOM': False}
    with (destination.parent / (destination.name + POLICY['suffixes']['extraction'])).open('xb') as output:
        output.write((json.dumps(result, indent=2) + '\n').encode())
    return result


if __name__ == '__main__':
    assert len(sys.argv) == 4, 'Provide repository, authenticated collection and fresh extraction directory'
    print(json.dumps(extract(*map(Path, sys.argv[1:4]))))
