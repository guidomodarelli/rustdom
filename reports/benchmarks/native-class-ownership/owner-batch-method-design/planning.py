"""Plan bounded future execution cost from authenticated old data; never predicts acceptance or executes workloads."""
import datetime
import json
import math
from pathlib import Path
import sys

from dispersion import POLICY, read_verified

PROSPECTIVE = json.loads((Path(__file__).parent / 'constants/prospective.json').read_bytes())


def linear_projection(elapsed, timed, batch):
    """Scale only archived timed work; omit unknown future setup/validation/GC costs explicitly."""
    if not math.isfinite(elapsed) or not math.isfinite(timed) or timed < 0:
        raise ValueError('Planning: finite elapsed and nonnegative timed durations required')
    if type(batch) is not int or batch < 1:
        raise ValueError('Planning: logical tasks per batch must be a positive integer')
    if elapsed < 0:
        return None
    projection = elapsed + (batch - 1) * timed
    if not math.isfinite(projection):
        raise ValueError('Planning: timed-only projection is not representable')
    return projection


def plan(repository):
    """Preserve real source identities and uncertified wall-clock endpoints without adding measurements."""
    assert PROSPECTIVE['executionReady'] is False and PROSPECTIVE['methodImplemented'] is False
    index = json.loads(read_verified(repository, PROSPECTIVE['captureIndex']))
    diagnostic = json.loads(read_verified(repository, POLICY['diagnosticFixture']))
    assert index['complete'] and index['sourceCommit'] == POLICY['sourceCommit']
    assert index['sourceChangesRaw'] == ''
    nodes = []
    for node in POLICY['nodes']:
        entries = [entry for entry in index['processes'] if entry['node'] == node]
        assert len(entries) == POLICY['processes'] // len(POLICY['nodes'])
        assert all(entry['exitCode'] == 0 and entry['signal'] is None and entry['error'] is None for entry in entries)
        first, last = entries[0]['startedAt'], entries[-1]['finishedAt']
        elapsed = (datetime.datetime.fromisoformat(last.replace('Z', '+00:00')) -
                   datetime.datetime.fromisoformat(first.replace('Z', '+00:00'))).total_seconds()
        records = [record for record in diagnostic['processes'] if record['node'] == node]
        assert len(records) == len(entries)
        timed = math.fsum(math.fsum(record['warmupMs'] + record['samplesMs']) for record in records) / 1000
        nodes.append({'node': node, 'processes': len(entries), 'firstProcessStartedAt': first,
                      'lastProcessFinishedAt': last, 'observedWallClockSeconds': elapsed,
                      'sumArchivedTimedSpansSeconds': timed,
                      'linearTimedOnlyProjectionSeconds': linear_projection(
                          elapsed, timed, PROSPECTIVE['logicalTasksPerBatch']),
                      'additionalUntimedSetupValidationGCCostIncluded': False,
                      'futureRuntimeGuaranteed': False})
    return {'sourceIndex': PROSPECTIVE['captureIndex'],
            'sourceDiagnosticSha256': POLICY['diagnosticFixture']['sha256'], 'nodes': nodes,
            'proposedBatchLogicalTasks': PROSPECTIVE['logicalTasksPerBatch'],
            'proposedCaptureTimeoutMinutesPerNode': PROSPECTIVE['captureTimeoutMinutesPerNode'],
            'proposedJobTimeoutMinutesPerNode': PROSPECTIVE['jobTimeoutMinutesPerNode'],
            'proposedNodeJobs': PROSPECTIVE['nodeJobs'],
            'clockConfidence': 'Endpoints de reloj del host sin certificación; no atribuyen causalidad CPU/GC/JIT',
            'executionReady': False, 'measurementExecuted': False,
            'performanceAccepted': None, 'gateReevaluated': False}


if __name__ == '__main__':
    repository, output = [Path(argument).resolve() for argument in sys.argv[1:3]]
    result = plan(repository)
    with output.open('x', encoding='utf-8', newline='\n') as stream:
        json.dump(result, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write('\n')
    print(json.dumps({'nodes': len(result['nodes']), 'executionReady': False, 'measurementExecuted': False}))
