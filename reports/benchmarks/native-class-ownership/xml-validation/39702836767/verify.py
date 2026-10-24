"""Verify available observations from the cancelled duplicate without granting acceptance."""
import hashlib
import json
import math
from pathlib import Path
import zipfile


def verify(directory):
    provenance = json.loads((directory / 'provenance.json').read_text())
    archive = directory / 'artifact.zip'
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == provenance['zipSha256']
    metadata = json.loads((directory / 'artifact-metadata.json').read_text())
    assert metadata['digest'] == 'sha256:' + provenance['zipSha256']
    run = json.loads((directory / 'run.json').read_text())
    assert run['conclusion'] == 'cancelled' and run['head_sha'] == provenance['head']
    with zipfile.ZipFile(archive) as bundle:
        assert bundle.testzip() is None
        entries = [{'path': entry.filename, 'bytes': entry.file_size, 'sha256': hashlib.sha256(bundle.read(entry)).hexdigest()}
            for entry in bundle.infolist() if not entry.is_dir()]
        assert entries == json.loads((directory / 'files.json').read_text())['files']
        index = json.loads(bundle.read('experiment.json'))
        assert index['complete'] is False and index.get('accepted') is None
        assert index['requestedHead'] == provenance['head']
        assert len(index['runs']) == provenance['recordedProcesses']
        measured = 0
        for process in index['runs']:
            assert process['stage'] == 'AA' and process['exitCode'] == 0 and process['signal'] is None
            observed = json.loads(bundle.read(process['stdoutFile']))
            assert observed == process['observations']
            assert observed['node'] == index['node'] and observed['engine'] == process['engine']
            for row in observed['results']:
                assert len(row['measuredBatchMs']) == index['settings']['XML_SERIALIZER_MEASURED_BATCHES']
                assert all(math.isfinite(value) and value > 0 for value in row['measuredBatchMs'])
                measured += len(row['measuredBatchMs'])
        return {'verified': True, 'complete': False, 'processes': len(index['runs']),
            'measuredDurations': measured, 'calibrated': None, 'accepted': None,
            'scope': 'Available cancelled A/A observations only; no budget decision.'}


if __name__ == '__main__':
    print(json.dumps(verify(Path(__file__).resolve().parent)))
