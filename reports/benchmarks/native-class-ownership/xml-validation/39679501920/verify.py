"""Recompute the completed XML gate from its original GitHub artifact, without executing workloads."""
import hashlib
import json
import math
from pathlib import Path
import statistics
import zipfile


def verify_document(index, bundle, protocol):
    """Verify actual stdout, process schedule, phase/pooled medians and all acceptance decisions."""
    assert index['complete'] is True
    assert index['node'] == protocol['node'] and index['requestedHead'] == protocol['head']
    assert index['sourceIdentity']['sourceHash'] == protocol['sourceHash']
    assert index['baselineSourceIdentity']['sourceHash'] == protocol['baselineSourceHash']
    assert index['phaseOrder'] == protocol['phaseOrder']
    assert index['calibration']['budgetPercent'] == protocol['calibrationBudgetPercent']
    assert index['regressionBudgetPercent'] == protocol['regressionBudgetPercent']
    stages = [('AA', index['calibration']['rows']), ('AB', index['comparisons']), ('reference', index['referenceComparison'])]
    measured = 0
    assert len(index['runs']) == protocol['processes']
    for run in index['runs']:
        assert run['exitCode'] == 0 and run['signal'] is None and run['error'] is None
        observed = json.loads(bundle.read(run['stdoutFile']))
        assert observed == run['observations']
        assert observed['node'] == index['node'] and observed['engine'] == run['engine']
        assert len(observed['results']) == 1
        row = observed['results'][0]
        assert f"{row['name']}/{row['size']}" == run['rowKey']
        assert len(row['warmupBatchMs']) == row['warmupBatches']
        assert len(row['measuredBatchMs']) == protocol['measuredBatches']
        assert all(math.isfinite(value) and value > 0 for value in row['warmupBatchMs'] + row['measuredBatchMs'])
        measured += len(row['measuredBatchMs'])
    hashes = {}
    for stage, stored_rows in stages:
        assert [f"{row['name']}/{row['size']}" for row in stored_rows] == protocol['rows']
        order = protocol['phaseOrder'] if stage != 'reference' else protocol['referenceOrder']
        selected = [run for run in index['runs'] if run['stage'] == stage]
        assert [(run['rowKey'], run['label']) for run in selected] == [(key, label) for key in protocol['rows'] for label in order]
        for stored in stored_rows:
            key = f"{stored['name']}/{stored['size']}"
            runs = [run for run in selected if run['rowKey'] == key]
            assert len(stored['phases']) == len(runs)
            samples = {'A': [], 'B': []}
            for run, phase in zip(runs, stored['phases']):
                expected_engine = 'jsdom' if stage == 'reference' and run['label'] == 'A' else 'rustdom'
                assert run['engine'] == expected_engine
                row = run['observations']['results'][0]
                assert row['outputHash'] == stored['outputHash']
                assert hashes.setdefault(key, row['outputHash']) == row['outputHash']
                assert phase['label'] == run['label']
                normalized = [value / row['batchSize'] for value in row['measuredBatchMs']]
                half = len(normalized) // 2
                for field, values in [('medianMs', normalized), ('firstHalfMs', normalized[:half]), ('lastHalfMs', normalized[half:])]:
                    assert math.isclose(statistics.median(values), phase[field], rel_tol=1e-12, abs_tol=1e-12)
                samples[run['label']] += normalized
            baseline, candidate = statistics.median(samples['A']), statistics.median(samples['B'])
            for field, value in [('baselineMs', baseline), ('candidateMs', candidate), ('changePercent', (candidate / baseline - 1) * 100)]:
                assert math.isclose(value, stored[field], rel_tol=1e-12, abs_tol=1e-12)
            assert stored['samplesPerLabel'] == {label: len(values) for label, values in samples.items()}
    assert measured == protocol['measuredDurations']
    calibrated = all(abs(row['changePercent']) <= protocol['calibrationBudgetPercent'] for row in index['calibration']['rows'])
    accepted = calibrated and all(row['changePercent'] <= protocol['regressionBudgetPercent'] for row in index['comparisons'])
    assert index['calibration']['pass'] == calibrated and index['accepted'] == accepted
    return {'verified': True, 'processes': len(index['runs']), 'measuredDurations': measured,
            'rows': len(protocol['rows']), 'calibrated': calibrated, 'accepted': accepted, 'scope': 'XML gate at the declared head only'}


def verify(directory):
    """Verify the official ZIP digest and per-entry bytes before recomputing scientific results."""
    protocol = json.loads((directory / 'constants/protocol.json').read_text())
    archive = directory / 'artifact.zip'
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == protocol['zipSha256']
    with zipfile.ZipFile(archive) as bundle:
        assert bundle.testzip() is None
        entries = [{'path': item.filename, 'bytes': item.file_size, 'sha256': hashlib.sha256(bundle.read(item)).hexdigest()}
                   for item in bundle.infolist() if not item.is_dir()]
        assert entries == json.loads((directory / 'files.json').read_text())['files']
        return verify_document(json.loads(bundle.read('experiment.json')), bundle, protocol)


if __name__ == '__main__':
    print(json.dumps(verify(Path(__file__).resolve().parent)))
