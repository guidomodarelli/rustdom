"""Read recorded XML input identities; never execute or reinterpret measured workloads."""
import json
from pathlib import Path
import sys
import zipfile

with zipfile.ZipFile(Path(sys.argv[1]) / 'artifact.zip') as bundle:
    index = json.loads(bundle.read('experiment.json'))
    print(json.dumps({'node': index['node'], 'platform': index['platform'], 'arch': index['arch'],
        'rustc': index['rustc'], 'sourceHash': index['sourceIdentity']['sourceHash'],
        'baselineSourceHash': index['baselineSourceIdentity']['sourceHash']}))
