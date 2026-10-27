"""Independent arithmetic audit of the published planning report; reads data only, never DOM."""
from __future__ import annotations

import hashlib
import json
import math
import pathlib
import sys


def audit(report_path: pathlib.Path) -> dict:
    """Recalculate all boundary scenarios and denominators without the JavaScript reducer."""
    if sys.flags.optimize:
        raise RuntimeError('Ownership confirmation audit: optimized Python disables required checks')
    source = pathlib.Path(__file__).resolve().parent
    design = json.loads((source / 'constants/design.json').read_text(encoding='utf-8'))
    report = json.loads(report_path.read_text(encoding='utf-8'))
    actual_inputs = {}
    for name, field in [('analysis.json', 'analysisSha256'), ('resource-endpoints.json', 'resourceSha256')]:
        raw = (source / 'planning-inputs' / name).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == design['planningEvidence'][field]
        actual_inputs[name] = json.loads(raw)
    analyses = actual_inputs['analysis.json']['sourceAnalysesPreservedUnmodified']
    assert len(analyses) == len(report['scenarios']) == 32
    for source_entry, scenario in zip(analyses, report['scenarios'], strict=True):
        entry = source_entry['sourceAnalysisUnmodified']
        assert entry['criterionId'] == scenario['criterionId']
        block_count = len(entry['blockMeans'])
        assert block_count == 16
        observed_a = math.fsum(block['baselineMeanMs'] for block in entry['blockMeans']) / block_count
        observed_b = math.fsum(block['candidateMeanMs'] for block in entry['blockMeans']) / block_count
        assert math.isclose(scenario['observedRatioOfArithmeticMeans'], observed_b / observed_a, rel_tol=1e-12)
        contrasts = [item for item in entry['contrasts'] if not item['diagnosticOnly']]
        assert len(contrasts) == len(scenario['boundaries']) == 2
        for contrast, boundary in zip(contrasts, scenario['boundaries'], strict=True):
            ratio = contrast['fixedRatio']
            assert ratio == boundary['fixedRatio']
            observed_contrast = math.fsum(block['candidateMeanMs'] - ratio * block['baselineMeanMs']
                                          for block in entry['blockMeans']) / block_count
            assert math.isclose(observed_contrast, boundary['observedContrastMeanMs'], rel_tol=1e-10, abs_tol=1e-14)
            half_width = 2.040 * contrast['standardDeviationUpper95Ms'] / math.sqrt(32)
            margin = (observed_contrast if ratio < 1 else -observed_contrast) - half_width
            assert math.isclose(half_width, boundary['hypotheticalHalfWidthMs'], rel_tol=1e-12)
            assert math.isclose(margin, boundary['hypotheticalSignedMarginMs'], rel_tol=1e-10, abs_tol=1e-14)
            assert scenario['futurePassPredicted'] is False
    elapsed = max(item['supervisor']['elapsedSeconds'] for item in actual_inputs['resource-endpoints.json']['criteria']) / 60
    jsdom_minutes = max(elapsed, 106.5) / 16 * 32 * 1.25
    assert math.isclose(report['timing']['forecasts']['jsdom']['projectedMinutes'], jsdom_minutes, rel_tol=1e-12)
    assert math.isclose(report['timing']['forecasts']['rustdom']['projectedMinutes'], 251.2 * 1.25, rel_tol=1e-12)
    assert report['timing']['feasible'] is True
    assert report['rejectedAlternative']['feasible'] is False
    # Two SDKs, two phases, eight rows, sixteen factors and two labels per block.
    processes = 2 * 2 * 8 * 16 * 2 * (32 + 16)
    assert report['population'] == dict(criteria=64, processes=processes, measuredDurations=processes * 144,
                                      warmupDurations=processes * 48, windows=processes * 12,
                                      documents=processes * 12, cleanupRounds=processes * 3,
                                      requiredFinalClearStates=processes * 2, parentSnapshots=64 * 3)
    assert report['executionReady'] is False
    assert report['performanceAccepted'] is None and report['gateReevaluated'] is False
    return dict(verified=True, criteria=32, boundaries=64, denominatorsRecomputed=True,
                scientificCaptureExecuted=False, performanceAccepted=None, gateReevaluated=False)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Ownership confirmation audit: provide the planning report JSON')
    print(json.dumps(audit(pathlib.Path(sys.argv[1])), indent=2))
