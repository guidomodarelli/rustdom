"""Read recorded XML input identities; never execute or reinterpret measured workloads."""
import json
import io
from pathlib import Path
import sys
import tarfile
import zipfile

with zipfile.ZipFile(Path(sys.argv[1]) / 'artifact.zip') as bundle:
    if len(sys.argv) > 2 and sys.argv[2] == '--full-inputs':
        policy = json.loads((Path(__file__).parent / 'constants/xml-observation-policy.json').read_text(encoding='utf8'))
        expected = policy['archiveRootDirectory'] + '/capture/observations/experiment.json'
        with tarfile.open(fileobj=io.BytesIO(bundle.read(policy['archiveTarFilename']))) as archive:
            matches = [member for member in archive.getmembers() if member.name == expected and member.isfile()]
            if len(matches) != 1:
                raise ValueError('XML identity: expected exactly one complete recorded experiment')
            index = json.loads(archive.extractfile(matches[0]).read())
    else:
        index = json.loads(bundle.read('experiment.json'))
    print(json.dumps({'node': index['node'], 'platform': index['platform'], 'arch': index['arch'],
        'rustc': index['rustc'], 'sourceHash': index['sourceIdentity']['sourceHash'],
        'baselineSourceHash': index['baselineSourceIdentity']['sourceHash']}))
