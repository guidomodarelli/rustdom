"""Independently check every synthetic point, Fieller quadratic and count; never authenticate or accept performance."""
import gzip
import hashlib
import json
import math
from pathlib import Path
import sys

if sys.flags.optimize:
    raise RuntimeError('Block planning audit requires non-optimized Python')

repository = Path(__file__).resolve().parents[5]
policy = json.loads((Path(__file__).parent / 'constants/model.json').read_bytes())
original = json.loads((Path(__file__).resolve().parents[2] / 'combined-process-study/constants/protocol.json').read_bytes())

def audit(directory):
    """Read known local simulation outputs without importing code from their files."""
    summary = json.loads((directory / 'summary.json').read_bytes())
    assert summary['complete'] and summary['planningOnly'] and summary['DOMExecuted'] is False
    assert summary['performanceAccepted'] is None and summary['gateReevaluated'] is False
    assert summary['policy'] == policy
    assert [case['scenario'] for case in summary['cases']] == policy['scenarios']
    assert len(summary['sourceFiles']) == 6
    for relative, expected in summary['sourceFiles'].items():
        member = Path(relative)
        assert not member.is_absolute() and '..' not in member.parts
        assert relative.startswith('reports/benchmarks/native-class-ownership/')
        filename = (repository / member).resolve(strict=True)
        assert filename.is_relative_to(repository)
        assert hashlib.sha256(filename.read_bytes()).hexdigest() == expected
    trials_checked = 0
    for case in summary['cases']:
        filename = case['scenario']['id'] + '.json.gz'
        assert case['rawFile'] == filename
        raw = (directory / filename).read_bytes()
        assert len(raw) == case['rawBytes'] and hashlib.sha256(raw).hexdigest() == case['rawSha256']
        data = json.loads(gzip.decompress(raw))
        assert {key: value for key, value in data.items() if key != 'syntheticResults'} == {
            key: value for key, value in case.items() if key not in ['rawFile', 'rawBytes', 'rawSha256']}
        assert data['scenario'] == case['scenario'] and data['trials'] == policy['trials']
        assert data['performanceAccepted'] is None and data['gateReevaluated'] is False
        assert len(data['syntheticResults']) == data['trials']
        replicate_count = policy['replicatesByEngine'][case['scenario']['engine']]
        assert data['blockReplicates'] == replicate_count and data['degreesOfFreedom'] == replicate_count - 1
        critical = policy['criticalByReplicates'][str(replicate_count)]
        coverage = 0
        within_budget = 0
        for index, trial in enumerate(data['syntheticResults']):
            assert trial['trial'] == index
            pairs = trial['syntheticBlockPairs']
            assert len(pairs) == replicate_count
            baseline = [pair['baselineMeanMs'] for pair in pairs]
            candidate = [pair['candidateMeanMs'] for pair in pairs]
            assert all(math.isfinite(value) and value > 0 for value in baseline + candidate)
            mean_baseline, mean_candidate = [math.fsum(values) / replicate_count for values in [baseline, candidate]]
            variance_baseline = math.fsum((value - mean_baseline) ** 2 for value in baseline) / (replicate_count - 1)
            variance_candidate = math.fsum((value - mean_candidate) ** 2 for value in candidate) / (replicate_count - 1)
            covariance = math.fsum((left - mean_baseline) * (right - mean_candidate) for left, right in zip(baseline, candidate)) / (replicate_count - 1)
            multiplier = critical ** 2 / replicate_count
            denominator = mean_baseline ** 2 - multiplier * variance_baseline
            center = mean_baseline * mean_candidate - multiplier * covariance
            constant = mean_candidate ** 2 - multiplier * variance_candidate
            discriminant = center ** 2 - denominator * constant
            # All actual generated models have well-conditioned bounded intervals.
            # This is an observation about this complete dataset, not a fallback for future inputs.
            assert denominator > 0 and discriminant >= 0
            lower = (center - math.sqrt(discriminant)) / denominator
            upper = (center + math.sqrt(discriminant)) / denominator
            interval = trial['interval']
            assert interval['status'] == 'bounded'
            assert math.isclose(interval['pointRatio'], mean_candidate / mean_baseline, rel_tol=1e-12)
            assert math.isclose(interval['intervalRatio'][0], lower, rel_tol=1e-9)
            assert math.isclose(interval['intervalRatio'][1], upper, rel_tol=1e-9)
            engine, phase = case['scenario']['engine'], case['scenario']['phase']
            bounds = original['aaJsdomBounds'] if engine == 'jsdom' else original['aaRustBounds'] if phase == 'AA' else [None, original['abRustUpperBound']]
            assert trial['ratioBounds'] == bounds
            passed = (bounds[0] is None or interval['intervalRatio'][0] >= bounds[0]) and interval['intervalRatio'][1] <= bounds[1]
            covered = interval['intervalRatio'][0] <= case['scenario']['trueRatio'] <= interval['intervalRatio'][1]
            assert trial['withinBudgetUnderWorkingModel'] == passed
            assert trial['boundedIntervalContainsTrueRatio'] == covered
            assert trial['performanceAccepted'] is None and trial['gateReevaluated'] is False
            within_budget += passed
            coverage += covered
        assert within_budget == data['withinBudgetTrials'] == case['withinBudgetTrials']
        assert coverage == data['boundedIntervalsContainingTruth'] == case['boundedIntervalsContainingTruth']
        assert data['boundedIntervals'] == data['trials']
        assert data['withinBudgetFraction'] == within_budget / data['trials']
        assert data['boundedCoverageFraction'] == coverage / data['trials']
        assert data['workingModelAssumptionsSatisfied'] == (data['scenario']['lagCorrelation'] == 0)
        trials_checked += data['trials']
    return {'cases': len(summary['cases']), 'syntheticTrialsChecked': trials_checked, 'independentQuadraticsChecked': trials_checked,
            'DOMExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False}

if __name__ == '__main__':
    assert len(sys.argv) == 2, 'Provide the complete synthetic output directory'
    print(json.dumps(audit(Path(sys.argv[1]).resolve(strict=True))))
