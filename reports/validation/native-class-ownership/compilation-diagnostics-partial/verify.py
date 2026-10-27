"""Verify the published partial artifact offline without executing its workers."""
import hashlib
import json
import pathlib
import sys
import tarfile


directory = pathlib.Path(__file__).resolve().parent
repository = directory.parents[3]
results = repository / 'reports/benchmarks/native-class-ownership/compilation-diagnostics-results'
receipt = json.loads((directory / 'receipt.json').read_bytes())
archive = directory / 'partial-capture-and-crash.tar.gz'
assert archive.stat().st_size == receipt['archiveBytes']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == receipt['archiveSha256']
with tarfile.open(archive) as stream:
    files = {member.name: member for member in stream.getmembers() if member.isfile()}
    assert len(files) == sum(member.isfile() for member in stream.getmembers())

    def read(relative):
        """Read an exact archived member without extracting or executing it."""
        return stream.extractfile(files['native-compilation-partial/' + relative]).read()

    def load(relative):
        return json.loads(read(relative))

    for name in ['summary.json', 'resource-summary.json', 'crash-symbolization.json',
                 'post-failure-verification-process.json', 'post-failure-verification.stdout.log',
                 'post-failure-verification.stderr.log', 'kernel-crash.log', 'reader-source.json']:
        assert read(name) == (directory / name).read_bytes(), name
    assert read('capture/index.json') == (directory / 'index.json').read_bytes()
    for name in ['analysis.json', 'summary.json', 'resource-summary.json', 'reader-source.json']:
        assert read(name) == (results / 'partial-4e1e66c1' / name).read_bytes(), name
    reader = read('analysis-reader.py')
    assert reader == (results / 'analyze.py').read_bytes()
    assert hashlib.sha256(reader).hexdigest() == load('reader-source.json')['sha256']
    publication = load('capture/publication.json')
    assert publication['commit'] == receipt['sourceCommit']
    for name, digest in publication['files'].items():
        archived = read('capture/method-sources/' + name)
        assert hashlib.sha256(archived).hexdigest() == digest, name
        assert archived == (repository / 'reports/benchmarks/native-class-ownership/compilation-diagnostics' / name).read_bytes()
    index = load('capture/index.json')
    assert not index['complete'] and index['accepted'] is None and not index['gateReevaluated']
    complete_batches, incomplete_batches, windows, documents, cleanup, final_clear, initial_not_clear, gc_events = [0] * 8
    intervals, traces, failures = 0, 0, []
    for process in index['processes']:
        prefix = 'capture/' + process['nodeVersion'] + '/' + process['physical'] + '/'
        report, telemetry = load(prefix + 'report.json'), load(prefix + 'report.json.telemetry.json')
        process_windows, process_documents = 0, 0
        for batch in report['batches']:
            complete_batches += bool(batch['complete'])
            incomplete_batches += not batch['complete']
            intervals += len(batch.get('sampleTimings', []))
            # trackedOwners is cumulative within a process, not a per-batch delta.
            if 'trackedOwners' in batch:
                assert batch['trackedOwners']['window'] >= process_windows
                assert batch['trackedOwners']['document'] >= process_documents
                process_windows = batch['trackedOwners']['window']
                process_documents = batch['trackedOwners']['document']
            observations = batch.get('cleanupTrace', [])
            cleanup += len(observations)
            final_clear += sum(observation['clear'] for observation in observations[-2:])
            initial_not_clear += sum(not observation['clear'] for observation in observations[:-2])
        windows += process_windows
        documents += process_documents
        if process['exitCode'] == 0:
            assert report['complete'] and telemetry['complete']
            trace = read(prefix + 'trace.json')
            assert hashlib.sha256(trace).hexdigest() == process['traceSha256']
            traces += 1
            gc_events += len(telemetry['gcEvents'])
        else:
            failures.append(process)
            assert process['signal'] == 'SIGSEGV' and not report['complete'] and not telemetry['complete']
            assert 'native-compilation-partial/' + prefix + 'trace.json' not in files
    assert traces == 9 and len(failures) == 1 and intervals == 876
    resources = load('resource-summary.json')
    observed = [complete_batches, incomplete_batches, windows, documents, cleanup, final_clear, initial_not_clear, gc_events]
    expected = [resources[key] for key in ['persistedCompleteBatches', 'persistedIncompleteBatches',
                'registeredWindowReferences', 'registeredDocumentReferences', 'cleanupObservationsInSavedBatches',
                'finalClearEndpointsInSavedBatches', 'initialNotClearObservationsInSavedBatches', 'gcEventsFromCompleteTelemetryOnly']]
    assert observed == expected, (observed, expected)
    analysis, summary = load('analysis.json'), load('summary.json')
    assert len(analysis['intervals']) == summary['recordedIntervals'] == intervals
    assert sum(span['eventsAvailable'] for span in analysis['intervals']) == summary['nativeEventIntervalsAvailable'] == 864
    assert sum(not span['eventsAvailable'] for span in analysis['intervals']) == summary['recordedIntervalsWithoutNativeEvents'] == 12
    assert analysis['plannedIntervals'] - intervals == summary['unrecordedPlannedIntervals'] == 84
    assert sum(process['traceEvents'] or 0 for process in analysis['processes']) == summary['nativeEventsObserved']
    assert sum(process['compilerCategoryCompleteEvents'] or 0 for process in analysis['processes']) == summary['compilerCategoryCompleteEventsObserved']
    assert analysis['gateReevaluated'] is False and analysis['accepted'] is None
result = {'archiveSha256': receipt['archiveSha256'], 'archiveBytes': archive.stat().st_size,
          'regularFiles': len(files), 'sourceFilesMatched': len(publication['files']),
          'completeTracesVerified': traces, 'failedWorkersPreserved': len(failures),
          'recordedIntervals': intervals, 'resourceCountersMatched': True,
          'sidecarsAndReaderMatched': True, 'measurementsExecuted': False, 'accepted': None}
if len(sys.argv) > 1:
    with pathlib.Path(sys.argv[1]).open('x') as output:
        json.dump(result, output, indent=2)
        output.write('\n')
print(json.dumps(result))
