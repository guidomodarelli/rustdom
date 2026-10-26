"""Generate numerical fixtures via SciPy root solving of the paired-t inequality, without executing DOM."""
import json
from pathlib import Path
import sys

if sys.flags.optimize:
    raise RuntimeError('Numerical reference: requires non-optimized Python to preserve guards')

import numpy
import scipy
from scipy.optimize import brentq
from scipy.stats import sem, t

POLICY = json.loads((Path(__file__).parent.parent / 'constants/reference.json').read_bytes())


def reference(pairs):
    """Invert the paired-t inequality numerically rather than duplicating the JS quadratic formula."""
    baseline = numpy.array([pair['baselineMeanMs'] for pair in pairs])
    candidate = numpy.array([pair['candidateMeanMs'] for pair in pairs])
    critical = float(t.ppf((1 + POLICY['confidenceLevel']) / 2, len(pairs) - 1))
    ratio = float(numpy.mean(candidate) / numpy.mean(baseline))
    result = {'criticalValue': critical, 'pointRatio': ratio, 'intervalRatio': None}
    if numpy.mean(baseline) ** 2 <= critical ** 2 * sem(baseline) ** 2:
        return {**result, 'status': 'unbounded'}
    if numpy.array_equal(candidate, baseline * ratio):
        return {**result, 'status': 'bounded', 'intervalRatio': [ratio, ratio]}

    def pivot(value):
        residuals = candidate - value * baseline
        return float(numpy.mean(residuals) ** 2 - critical ** 2 * sem(residuals) ** 2)

    left, right = -ratio, ratio * 2
    while pivot(left) <= 0:
        left *= 2
    while pivot(right) <= 0:
        right *= 2
    options = {'xtol': POLICY['rootAbsoluteTolerance'], 'rtol': POLICY['rootRelativeTolerance']}
    return {**result, 'status': 'bounded',
            'intervalRatio': [brentq(pivot, left, ratio, **options), brentq(pivot, ratio, right, **options)]}


def generate(output):
    """Write a fresh, reproducible reference file; fixtures are numbers, never execution measurements."""
    assert numpy.__version__ == POLICY['numpyVersion']
    assert scipy.__version__ == POLICY['scipyVersion']
    assert not output.exists(), 'Numerical reference: preserve previous output'
    cohorts = {
        'proportional': [(1 + index % 7 / 10, 2 * (1 + index % 7 / 10)) for index in range(POLICY['fixturePairCount'])],
        'correlated': [(8 + index % 11 * 1.3 + index // 11 * 0.5,
                        (8 + index % 11 * 1.3 + index // 11 * 0.5) * 1.015 + (index * 7 % 13 - 6) * 0.11)
                       for index in range(POLICY['fixturePairCount'])],
        'opposed': [(10 + index % 12 / 4, 12 - index % 12 / 7 + index * 5 % 7 * 0.12) for index in range(POLICY['fixturePairCount'])],
        'shifted': [(5 + index % 9 * 0.15, 5 + index % 9 * 0.15 + 0.17 + index % 5 * 0.03)
                    for index in range(POLICY['fixturePairCount'])],
        'uncertain-baseline': [(0.000001, 2), (100, 2)],
    }
    cases = []
    for name, durations in cohorts.items():
        pairs = [{'baselineMeanMs': baseline, 'candidateMeanMs': candidate} for baseline, candidate in durations]
        cases.append({'name': name, 'pairs': pairs, 'expected': reference(pairs)})
    result = {'purpose': 'synthetic-numerical-reference-only', 'domExecuted': False, 'benchmarkExecuted': False,
              'performanceAccepted': None, 'gateReevaluated': False, 'confidenceLevel': POLICY['confidenceLevel'],
              'producer': {'python': sys.version, 'platform': sys.platform},
              'numpy': numpy.__version__, 'scipy': scipy.__version__,
              'method': 'Brent root solving of the paired-t inequality, independent of the JS quadratic implementation',
              'cases': cases}
    with output.open('x', encoding='utf-8', newline='\n') as stream:
        stream.write(json.dumps(result, indent=2) + '\n')
    return result


if __name__ == '__main__':
    assert len(sys.argv) == 2, 'Provide a fresh numerical reference JSON filename'
    generated = generate(Path(sys.argv[1]))
    print(json.dumps({'cases': len(generated['cases']), 'benchmarkExecuted': False, 'performanceAccepted': None}))
