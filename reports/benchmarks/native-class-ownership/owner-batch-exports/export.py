"""Export existing authenticated captures with current readers; never execute a DOM workload or captured script."""
import sys
if sys.flags.optimize:
    raise RuntimeError('Owner batch export: optimized Python disables required assertions; refusing before filesystem or commands')
import hashlib
import json
import os
import runpy
import signal
import subprocess
import zlib
from pathlib import Path


def read_json(filename):
    with Path(filename).open('r', encoding='utf-8') as stream:
        return json.load(stream)


def write_new_json(filename, value):
    with Path(filename).open('x', encoding='utf-8', newline='\n') as stream:
        json.dump(value, stream, indent=2, allow_nan=False); stream.write('\n')


def publish_receipt(destination, configuration, result, checksum):
    """Publish completion only after the manifest exists; a failure cannot leave a complete summary without its manifest."""
    pending = destination / (configuration['summaryFilename'] + '.pending')
    summary = destination / configuration['summaryFilename']
    write_new_json(pending, result)
    manifest = {filename.name: {'bytes': filename.stat().st_size, 'sha256': checksum(filename)}
                for filename in sorted(destination.iterdir()) if filename.is_file() and filename != pending}
    manifest[summary.name] = {'bytes': pending.stat().st_size, 'sha256': checksum(pending)}
    write_new_json(destination / configuration['manifestFilename'], {'files': manifest, 'tableFiles': result.get('tableFiles', {})})
    os.link(pending, summary)  # Exclusive publication; never overwrite existing evidence.
    try:
        pending.unlink()
    except OSError as error:
        sys.stderr.write('Owner batch export: complete data published, but removing the owned temporary receipt failed: ' + str(error) + '\n')


def run_invoker(argv, stdout, stderr):
    """Forward catchable cancellation to the current invoker and wait for its owned reader group to terminate."""
    child = None
    interrupted_by = None
    def forward(signum, frame):
        nonlocal interrupted_by
        interrupted_by = interrupted_by or signum
        if child is not None:
            try:
                child.send_signal(signum)
            except ProcessLookupError:
                pass  # The owned invoker already terminated; wait still reaps it below.
    previous = {signum: signal.signal(signum, forward) for signum in [signal.SIGINT, signal.SIGTERM]}
    try:
        if interrupted_by is not None:
            raise InterruptedError('Owner batch export: cancellation preceded invoker launch')
        child = subprocess.Popen(argv, stdout=stdout, stderr=stderr, start_new_session=True)
        if interrupted_by is not None:
            forward(interrupted_by, None)  # Cover a signal delivered during Popen before its result was assigned.
        returncode = child.wait()
        return subprocess.CompletedProcess(argv, returncode), interrupted_by
    finally:
        for signum, handler in previous.items():
            signal.signal(signum, handler)


def export_authenticated(node, operation, binding, collection, destination):
    source = Path(__file__).resolve().parent
    repository = source.parents[3]
    configuration = read_json(source / 'constants/exports.json')
    archive_reader = runpy.run_path(str(source / 'archive.py'))
    table_writer = runpy.run_path(str(source / 'tables.py'))
    checksum = archive_reader['digest']
    own_files = {name: checksum(source / name) for name in ['export.py', 'archive.py', 'tables.py', 'invoke.cjs', 'constants/exports.json']}
    assert operation in ['--functional', '--verify'], 'Owner batch export: require an explicit functional or scientific mode'
    assert 'NODE_OPTIONS' not in os.environ, 'Owner batch export: reject ambient Node preloads'
    executables = read_json(repository / configuration['executablePolicy'])['runtimeExecutableHashes']
    node = Path(node).resolve(strict=True)
    node_sha = checksum(node)
    assert node_sha in executables.values(), 'Owner batch export: executable is not a fixed reader SDK'
    node_version = subprocess.check_output([str(node), '--version'], text=True).strip()
    assert executables[node_version] == node_sha
    collection = Path(collection).resolve(strict=True)
    binding = Path(binding).resolve(strict=True)
    destination = Path(destination)
    destination = destination.parent.resolve(strict=True) / destination.name
    for protected in [repository, collection]:
        assert not destination.is_relative_to(protected) and not protected.is_relative_to(destination), 'Owner batch export: output must be disjoint'
    assert not destination.exists() and not destination.is_symlink(), 'Owner batch export: preserve existing output'
    destination.mkdir()
    result = {'revision': configuration['revision'], 'mode': 'functional' if operation == '--functional' else 'capture',
              'complete': False, 'DOMExecuted': False, 'archivedCodeExecuted': False, 'newBenchmarkSamples': False,
              'readerNode': node_version, 'readerNodeSha256': node_sha, 'pythonVersion': sys.version,
              'pythonExecutable': sys.executable, 'zlibVersion': zlib.ZLIB_RUNTIME_VERSION,
              'pythonReaderFiles': own_files, 'scope': configuration['scope'],
              'performanceAccepted': None, 'gateReevaluated': False}
    failure = None
    completed_decision = None
    try:
        with (destination / configuration['orchestratorStdoutFilename']).open('xb') as stdout, (destination / configuration['orchestratorStderrFilename']).open('xb') as stderr:
            child, interrupted_by = run_invoker([str(node), str(source / 'invoke.cjs'), operation, str(binding), str(collection), str(destination)],
                                               stdout=stdout, stderr=stderr)
        result['decisionCLIExitCode'] = child.returncode
        if interrupted_by is not None:
            result['interruptedBy'] = signal.Signals(interrupted_by).name
            raise InterruptedError('Owner batch export: cancelled invoker terminated; raw logs and partials retained')
        decision_file = destination / configuration['verifiedDirectory'] / configuration['decisionFilename']
        assert decision_file.is_file(), 'Owner batch export: bounded reader did not produce a decision; inspect invocation/logs'
        decision = read_json(decision_file)
        assert decision['revision'] == configuration['producerRevision'], 'Owner batch export: unsupported producer method'
        result.update(decisionSha256=checksum(decision_file), decisionComplete=decision['complete'],
                      transportAuthenticated=decision['transportAuthenticated'], captureAuthenticated=decision['captureAuthenticated'])
        if not decision['complete']:
            result['failure'] = decision.get('failure', {'message': 'Authenticated decision is incomplete; raw inputs and partials retained'})
            return result
        assert decision['readerNode'] == node_version
        assert child.returncode == (1 if decision['performanceAccepted'] is False else 0)
        if result['mode'] == 'functional':
            assert decision['performanceAccepted'] is None and decision['gateReevaluated'] is False
        else:
            assert decision['captureAuthenticated'] is True and type(decision['performanceAccepted']) is bool and decision['gateReevaluated'] is True
        parts = {}
        for reference in decision['parts']:
            filename = Path(reference['filename']).resolve(strict=True)
            assert filename.is_relative_to(destination) and filename.stat().st_size == reference['bytes']
            assert checksum(filename) == reference['sha256']
            part = read_json(filename)
            assert part['verified'] is True and part['payloadComplete'] is True
            parts[part['runtime']['node']] = part
        transport = read_json(repository / configuration['transportPolicy'])
        sampler = read_json(repository / configuration['samplerPolicy'])
        assert list(parts) == ['v' + producer_version for producer_version in transport['nodes']]
        for record in decision['transport']['tarFiles']:
            assert Path(record['archive']).resolve(strict=True).is_relative_to(destination)
        tables = destination / configuration['tablesDirectory']; tables.mkdir()
        counts = table_writer['export_tables'](decision, parts, tables, configuration, sampler, transport, archive_reader)
        if result['mode'] == 'capture':
            write_new_json(tables / configuration['comparisonFilename'], decision['comparison'])
        result.update(counts=counts, sourceRunId=decision['transport']['runId'], sourceCommit=decision['transport']['head'],
                      sourceArtifacts=decision['transport']['artifacts'], readerIdentity=decision['readerIdentity'],
                      nodeReaderSourceFiles=decision['readerSourceFiles'], nodeReaderFilesAfterExport={},
                      sourceDecisionRetainedUnchanged=checksum(decision_file) == result['decisionSha256'])
        assert result['sourceDecisionRetainedUnchanged']
        for relative, expected in decision['readerSourceFiles'].items():
            actual = checksum(repository / relative)
            assert actual == expected, 'Owner batch export: current Node reader changed during export'
            result['nodeReaderFilesAfterExport'][relative] = actual
        assert own_files == {name: checksum(source / name) for name in own_files}, 'Owner batch export: Python formatter changed during export'
        result['tableFiles'] = {filename.name: {'bytes': filename.stat().st_size, 'sha256': checksum(filename)} for filename in sorted(tables.iterdir())}
        completed_decision = decision
        return result
    except BaseException as error:
        failure = error
        result.update(complete=False, performanceAccepted=None, gateReevaluated=False,
                      failure={'type': type(error).__name__, 'message': str(error)})
        raise
    finally:
        try:
            candidate = {**result, **({'complete': True, 'performanceAccepted': completed_decision['performanceAccepted'],
                                     'gateReevaluated': completed_decision['gateReevaluated']} if completed_decision is not None else {})}
            publish_receipt(destination, configuration, candidate, checksum)
            result.update(candidate)
        except BaseException as error:
            if failure is None:
                raise
            sys.stderr.write('Owner batch export: preserving export failure while receipt persistence also failed: ' + str(error) + '\n')


if __name__ == '__main__':
    if len(sys.argv) != 6:
        raise SystemExit('Owner batch export: provide fixed Node executable, --functional/--verify, independent binding, collection and new output')
    result = export_authenticated(*sys.argv[1:])
    print(json.dumps({key: result.get(key) for key in ['complete', 'mode', 'sourceRunId', 'counts', 'performanceAccepted', 'gateReevaluated']}))
    raise SystemExit(2 if not result['complete'] else 1 if result['performanceAccepted'] is False else 0)
