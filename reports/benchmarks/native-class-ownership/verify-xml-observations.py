"""Recompute the unchanged XML protocol, preserving incomplete A/B after failed calibration."""
import json
import math
from pathlib import Path
import statistics
import sys

if sys.flags.optimize:
    raise RuntimeError('XML observations verification requires Python assertions; disable -O, -OO and PYTHONOPTIMIZE.')

PROTOCOL_PATH = Path(__file__).parent / 'xml-validation/39697882498/constants/protocol.json'
POLICY = json.loads((Path(__file__).parent / 'constants/xml-observation-policy.json').read_text(encoding='utf8'))


def assert_serialized_number_matches(actual, expected):
    """Use the historical verifier's tolerance only for serialized floating point arithmetic."""
    assert math.isclose(actual, expected, rel_tol=POLICY['arithmeticRelativeTolerance'],
                        abs_tol=POLICY['arithmeticAbsoluteTolerance'])


def verify_observations(index, read_bytes):
    """Verify every recorded worker and recompute all decisions without running a workload.

    Source/build eligibility is separate: this function proves the scientific record,
    not correspondence of a historical artifact to current production inputs.
    """
    protocol = json.loads(PROTOCOL_PATH.read_text(encoding='utf8'))
    assert index['complete'] is True
    assert index['node'] == protocol['node']
    assert index['phaseOrder'] == protocol['phaseOrder']
    settings = index['settings']
    assert settings['XML_SERIALIZER_WARMUP_PHASE_ORDER'] == protocol['phaseOrder']
    assert settings['XML_SERIALIZER_CALIBRATION_BUDGET_PERCENT'] == protocol['calibrationBudgetPercent']
    assert settings['XML_SERIALIZER_REGRESSION_BUDGET_PERCENT'] == protocol['regressionBudgetPercent']
    assert settings['XML_SERIALIZER_MEASURED_BATCHES'] == protocol['measuredBatches']
    assert settings['XML_SERIALIZER_WARMUP_BATCHES'] == POLICY['warmupBatches']
    assert settings['XML_SERIALIZER_WARMUP_BATCHES_BY_SIZE'] == POLICY['warmupBatchesBySize']
    assert settings['XML_SERIALIZER_BATCH_SIZES'] == POLICY['batchSizes']
    assert index['calibration']['budgetPercent'] == protocol['calibrationBudgetPercent']
    calibrated = index['calibration']['pass']
    assert type(calibrated) is bool
    stages = [('AA', index['calibration']['rows'])]
    if calibrated:
        assert index['regressionBudgetPercent'] == protocol['regressionBudgetPercent']
        stages += [('AB', index['comparisons']), ('reference', index['referenceComparison'])]
    else:
        assert index['accepted'] is None
        assert index['comparisons'] == []
        assert not index.get('referenceComparison')
    schedule = [(stage, row, label) for stage, _ in stages for row in protocol['rows']
                for label in (protocol['referenceOrder'] if stage == 'reference' else protocol['phaseOrder'])]
    assert [(run['stage'], run['rowKey'], run['label']) for run in index['runs']] == schedule
    for ordinal, run in enumerate(index['runs']):
        prefix = f"{run['stage']}-{ordinal}-{run['label']}"
        assert run['stdoutFile'] == prefix + '.stdout.json'
        assert run['stderrFile'] == prefix + '.stderr.log'
    hashes, measured, recalculated = {}, 0, {}
    for stage, stored_rows in stages:
        assert [f"{row['name']}/{row['size']}" for row in stored_rows] == protocol['rows']
        stage_rows = []
        for stored in stored_rows:
            key = f"{stored['name']}/{stored['size']}"
            runs = [run for run in index['runs'] if run['stage'] == stage and run['rowKey'] == key]
            assert len(stored['phases']) == len(runs)
            samples = {'A': [], 'B': []}
            for run, phase in zip(runs, stored['phases']):
                assert run['exitCode'] == 0 and run['signal'] is None and run['error'] is None
                assert run['engine'] == ('jsdom' if stage == 'reference' and run['label'] == 'A' else 'rustdom')
                expected_root = index['baseline'] if stage == 'AA' or stage == 'AB' and run['label'] == 'A' else index['candidate']
                assert run['runtimeRoot'] == expected_root
                read_bytes(run['stderrFile'])
                observed = json.loads(read_bytes(run['stdoutFile']))
                assert observed == run['observations']
                assert observed['node'] == index['node'] and observed['engine'] == run['engine']
                assert len(observed['results']) == 1
                row = observed['results'][0]
                assert f"{row['name']}/{row['size']}" == key
                assert row['batchSize'] == settings['XML_SERIALIZER_BATCH_SIZES'][str(row['size'])]
                warmup = settings['XML_SERIALIZER_WARMUP_BATCHES_BY_SIZE'].get(str(row['size']), POLICY['warmupBatches'])
                assert row['warmupBatches'] == warmup and len(row['warmupBatchMs']) == warmup
                assert len(row['measuredBatchMs']) == protocol['measuredBatches']
                assert all(type(value) in (int, float) and math.isfinite(value) and value > 0
                           for value in row['warmupBatchMs'] + row['measuredBatchMs'])
                assert row['outputHash'] == stored['outputHash']
                assert hashes.setdefault(key, row['outputHash']) == row['outputHash']
                assert phase['label'] == run['label']
                normalized = [value / row['batchSize'] for value in row['measuredBatchMs']]
                half = len(normalized) // 2
                for name, values in [('medianMs', normalized), ('firstHalfMs', normalized[:half]), ('lastHalfMs', normalized[half:])]:
                    assert_serialized_number_matches(phase[name], statistics.median(values))
                samples[run['label']] += normalized
                measured += len(row['measuredBatchMs'])
            baseline, candidate = statistics.median(samples['A']), statistics.median(samples['B'])
            change = (candidate / baseline - 1) * 100
            for name, value in [('baselineMs', baseline), ('candidateMs', candidate), ('changePercent', change)]:
                assert_serialized_number_matches(stored[name], value)
            assert stored['samplesPerLabel'] == {label: len(values) for label, values in samples.items()}
            stage_rows.append({'name': stored['name'], 'size': stored['size'], 'baselineMs': baseline,
                               'candidateMs': candidate, 'changePercent': change, 'outputHash': stored['outputHash'],
                               'samplesPerLabel': {label: len(values) for label, values in samples.items()}})
        recalculated[stage] = stage_rows
    actual_calibration = all(abs(row['changePercent']) <= protocol['calibrationBudgetPercent'] for row in recalculated['AA'])
    assert calibrated == actual_calibration
    accepted = all(row['changePercent'] <= protocol['regressionBudgetPercent'] for row in recalculated['AB']) if calibrated else None
    assert index['accepted'] is accepted
    return {'verified': True, 'rows': len(protocol['rows']), 'processes': len(index['runs']),
            'measuredDurations': measured, 'calibrated': calibrated, 'accepted': accepted,
            'abExecuted': calibrated, 'summaries': recalculated, 'measurementExecuted': False,
            'currentInputEligibilityVerified': False}
