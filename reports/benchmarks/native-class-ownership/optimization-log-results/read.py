"""Authenticate the preserved capture and stream every bracket header into a lossless ledger."""
import collections
import importlib.util
import json
import pathlib
import re
import sys


METHOD = pathlib.Path(__file__).resolve().parent
SETTINGS = json.loads((METHOD / 'constants/reading.json').read_bytes())
PATTERNS = {name: re.compile(pattern) for name, pattern in SETTINGS['patterns'].items()}


def parse_header(line):
    if not line.startswith('['):
        return None
    raw = line.rstrip('\r\n')
    category = next((category for prefix, category in SETTINGS['prefixes'] if raw.startswith(prefix)), 'unclassified-bracket-line')
    result = {'category': category, 'raw': raw}
    if category == 'bailout-start':
        reason = PATTERNS['bailoutReason'].search(raw)
        if reason:
            result.update(kind=reason.group(1), reason=reason.group(2))
    elif category == 'dependent-code':
        reason = PATTERNS['dependentReason'].search(raw)
        if reason:
            result['reason'] = reason.group(1)
    if 'reason' not in result:
        reason = PATTERNS['abortReason'].search(raw) or PATTERNS['dependentReason'].search(raw)
        if reason:
            result['reason'] = reason.group(1)
    function = PATTERNS['function'].search(raw)
    shared = PATTERNS['sharedFunction'].search(raw)
    if function:
        description = function.group(1)
        name, separator, source = description.rpartition(' <')
        if separator:
            result.update(functionName=name, source=source.removesuffix('>'))
        elif description.startswith('<'):
            result.update(functionName='', source=description[1:].removesuffix('>'))
        else:
            result['functionName'] = description
        result['sfiAddress'] = function.group(2)
    elif shared:
        result['functionName'] = shared.group(1)
    for pattern, field in [('tier', 'tier'), ('targetTier', 'targetTier'), ('optimizationId', 'optimizationId')]:
        match = PATTERNS[pattern].search(raw)
        if match:
            result[field] = match.group(1)
    return result


def authenticate(capture):
    index = json.loads((capture / 'index.json').read_bytes())
    assert index['complete'] and index['captureStarted'] and index['accepted'] is None and not index['gateReevaluated']
    module_path = capture / 'sources/method/reports/benchmarks/native-class-ownership/optimization-log/run.py'
    spec = importlib.util.spec_from_file_location('frozen_optimization_driver', module_path)
    driver = importlib.util.module_from_spec(spec)
    exec(compile(module_path.read_bytes(), str(module_path), 'exec'), driver.__dict__)
    assert index['settings'] == driver.SETTINGS
    assert index['methodSources'] == driver.source_identity() == index['publication']['files']
    actual_names = {item.relative_to(capture).as_posix() for item in capture.rglob('*') if item.is_file() and item != capture / 'index.json'}
    assert actual_names == set(index['files']), 'Optimization reading: incomplete file inventory'
    for name, checksum in index['files'].items():
        assert driver.digest(capture / name) == checksum, name
    ledger = json.loads((capture / 'sources/method' / driver.SETTINGS['sourceLedger']).read_bytes())
    assert driver.digest(capture / 'sources/method' / driver.SETTINGS['sourceLedger']) == driver.SETTINGS['sourceLedgerSha256']
    assert driver.digest(capture / 'local-manifest.json') == driver.SETTINGS['localManifestSha256']
    assert driver.digest(capture / 'reference-report.json') == driver.SETTINGS['referenceReportSha256']
    for entry in ledger['files']:
        assert driver.digest(capture / 'sources/frozen' / entry['path']) == entry['sha256']
    reference = json.loads((capture / 'reference-report.json').read_bytes())
    manifest = json.loads((capture / 'local-manifest.json').read_bytes())
    for ordinal in range(len(driver.SETTINGS['nodeVersions'])):
        before = json.loads((capture / f'node-{ordinal}-before/stdout.log').read_bytes())
        after = json.loads((capture / f'node-{ordinal}-after/stdout.log').read_bytes())
        assert before == after == manifest['preparationBefore'] == index['preparationExpected']
    expected = [(node, physical) for node, packages in zip(driver.SETTINGS['nodeVersions'], driver.SETTINGS['physicalOrder']) for physical in packages]
    assert [(worker['node'], worker['physical']) for worker in index['workers']] == expected
    for worker in index['workers']:
        directory = pathlib.PurePosixPath(worker['directory']).name
        report = json.loads((capture / directory / 'report.json').read_bytes())
        result = driver.inspect_report(report, worker['node'], worker['physical'], reference)
        assert all(worker[name] == value for name, value in result.items())
        assert report['execArgv'] == driver.SETTINGS['flags']
        command = next(command for command in index['commands'] if command['directory'] == worker['directory'])
        assert command['complete'] and command['exitCode'] == 0 and command['pid'] == report['pid']
    return index, driver


def describe(capture_argument, output_argument):
    capture, output = pathlib.Path(capture_argument).resolve(), pathlib.Path(output_argument).resolve()
    assert capture != output and capture not in output.parents and output not in capture.parents
    index, driver = authenticate(capture)
    output.mkdir()
    summary = {'diagnosticOnly': True, 'acceptanceChanged': False, 'accepted': None, 'inputFilesAuthenticated': len(index['files']),
               'methodSourceFilesMatched': len(index['methodSources']), 'workers': [],
               'limits': 'Headers are log records, not unique compilations, CPU time or pauses. Payload lines remain in raw logs. Addresses are not stable identities; no time alignment to samples or causal attribution.'}
    with (output / 'headers.jsonl').open('w', encoding='utf-8', newline='\n') as ledger:
        for worker in index['workers']:
            directory = pathlib.PurePosixPath(worker['directory']).name
            streams = []
            for stream_name in ['stdout', 'stderr']:
                filename = capture / directory / (stream_name + '.log')
                categories, reasons, functions = collections.Counter(), collections.Counter(), collections.Counter()
                lines, headers = 0, 0
                with filename.open(encoding='utf-8', newline='') as stream:
                    for line_number, line in enumerate(stream, 1):
                        lines += 1
                        header = parse_header(line)
                        if header is None:
                            continue
                        headers += 1
                        categories[header['category']] += 1
                        if 'reason' in header:
                            reasons[(header['category'], header['reason'])] += 1
                        if 'functionName' in header:
                            functions[(header['category'], header['functionName'], header.get('source'))] += 1
                        ledger.write(json.dumps({'node': worker['node'], 'physical': worker['physical'], 'stream': stream_name,
                                                 'line': line_number, **header}) + '\n')
                streams.append({'stream': stream_name, 'bytes': filename.stat().st_size, 'lines': lines, 'headerLines': headers,
                                'payloadLines': lines - headers, 'categories': dict(sorted(categories.items())),
                                'reasons': [{'category': category, 'reason': reason, 'count': count} for (category, reason), count in sorted(reasons.items())],
                                'functions': [{'category': category, 'functionName': function, 'source': source, 'count': count}
                                              for (category, function, source), count in sorted(functions.items(), key=lambda item: tuple('' if value is None else value for value in item[0]))]})
            summary['workers'].append({'node': worker['node'], 'physical': worker['physical'], 'streams': streams})
    summary['headerLedgerSha256'] = driver.digest(output / 'headers.jsonl')
    (output / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8', newline='\n')
    return summary


if __name__ == '__main__':
    result = describe(*sys.argv[1:3])
    print(json.dumps({'workers': len(result['workers']), 'inputFilesAuthenticated': result['inputFilesAuthenticated'],
                      'headers': sum(stream['headerLines'] for worker in result['workers'] for stream in worker['streams']),
                      'accepted': None, 'acceptanceChanged': False}, indent=2))
