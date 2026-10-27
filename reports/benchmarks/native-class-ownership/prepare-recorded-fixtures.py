"""Prepare immutable real-data fixtures for the ownership CI replay; never run a DOM sampler."""
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys
import time

if sys.flags.optimize:
    raise RuntimeError('Ownership fixtures: Python optimization disables required checks; unset PYTHONOPTIMIZE')
script_directory = pathlib.Path(__file__).resolve().parent
settings = json.loads((script_directory / 'constants/recorded-fixtures.json').read_bytes())
archive_settings = json.loads((script_directory / 'constants/recorded-archive.json').read_bytes())
policy = json.loads((script_directory / 'constants/row-isolation-evidence.json').read_bytes())


def owned_path(root, relative):
    """Resolve canonical archive-relative source names inside their actual owner."""
    assert isinstance(relative, str) and relative and '\\' not in relative and ':' not in relative
    name = pathlib.PurePosixPath(relative)
    assert not name.is_absolute() and '..' not in name.parts and name.as_posix() == relative, (
        'Ownership fixtures: noncanonical source path')
    filename = root / relative
    assert filename.resolve().is_relative_to(root.resolve()), 'Ownership fixtures: source path escapes owner'
    return filename


def prepare(baseline_argument, parts_argument, output_argument):
    """Materialize and authenticate both original datasets in a fresh workspace-owned directory."""
    repository = pathlib.Path.cwd().resolve()
    baseline = pathlib.Path(baseline_argument).resolve(strict=True)
    parts_root = pathlib.Path(parts_argument).resolve(strict=True)
    output = pathlib.Path(output_argument)
    assert baseline.is_dir() and parts_root.is_dir(), 'Ownership fixtures: baseline and parts must be directories'
    assert not output.exists() and not output.is_symlink(), 'Ownership fixtures: preserve an existing output directory'
    assert output.parent.is_dir(), 'Ownership fixtures: output parent must exist'
    output = output.parent.resolve(strict=True) / output.name
    assert all(output != root and not output.is_relative_to(root) for root in [baseline, parts_root]), (
        'Ownership fixtures: output cannot modify the baseline or recorded parts')
    parts = json.loads((parts_root / archive_settings['manifestFilename']).read_bytes())
    assert parts['archive']['sha256'] == policy['archive']['sha256'], 'Ownership fixtures: undeclared row archive'
    assert next(entry['sha256'] for entry in parts['sidecars'] if entry['filename'] == policy['rawManifest']['filename']) == policy['rawManifest']['sha256'], (
        'Ownership fixtures: undeclared row member manifest')
    row_receipt_bytes = (parts_root / 'receipt.json').read_bytes()
    assert hashlib.sha256(row_receipt_bytes).hexdigest() == parts['originalReceiptSha256']
    row_receipt = json.loads(row_receipt_bytes)
    assert row_receipt['result']['verified'] and row_receipt['result']['accepted'] is False
    output.mkdir()
    commands = output / 'commands'
    commands.mkdir()

    def execute(name, arguments):
        """Preserve command PID, stderr and exit before deciding whether preparation can continue."""
        command = [sys.executable, '-B', *arguments]
        record = {'command': command, 'cwd': str(repository), 'startedAt': time.time(), 'measurementExecuted': False}
        with (commands / (name + '.stdout.log')).open('xb') as stdout, (commands / (name + '.stderr.log')).open('xb') as stderr:
            child = subprocess.Popen(command, cwd=repository, stdout=stdout, stderr=stderr)
            record['pid'] = child.pid
            (commands / (name + '.process.json')).write_text(json.dumps(record, indent=2) + '\n')
            record['exitCode'] = child.wait()
        record['finishedAt'] = time.time()
        (commands / (name + '.process.json')).write_text(json.dumps(record, indent=2) + '\n')
        assert record['exitCode'] == 0, f'Ownership fixtures: {name} failed; inspect {commands}'

    row_archive = output / 'row-archive'
    execute('materialize-row', [str(script_directory / 'materialize-recorded-archive.py'), str(parts_root), str(row_archive)])
    extracted = output / settings['extractionDirectory']
    extracted.mkdir()
    row_extracted = extracted / 'row'
    row_extracted.mkdir()
    execute('extract-row', [str(script_directory / 'recorded-evidence-extract.py'),
        str(row_archive / policy['archive']['filename']), str(row_archive / policy['rawManifest']['filename']),
        settings['rowArchivePrefix'], str(row_extracted)])
    row_bundle = row_extracted / settings['rowArchivePrefix']
    row_study = row_bundle / 'study'
    assert json.loads((row_study / 'verification.json').read_bytes()) == row_receipt['result']
    build_inputs = json.loads((row_bundle / 'runtime-inputs/build-inputs.json').read_bytes())['buildInputHashes']
    assert build_inputs == policy['buildInputHashes'], 'Ownership fixtures: compiled/current build input mapping differs'

    seeded_source = repository / settings['seededArchiveDirectory']
    seeded_receipt = json.loads((seeded_source / 'receipt.json').read_bytes())
    assert seeded_receipt['result']['verified'] and seeded_receipt['result']['accepted'] is False
    seeded_files = json.loads((seeded_source / 'files.json').read_bytes())
    seeded_archive = output / 'seeded-archive'
    seeded_archive.mkdir()
    for name in [archive_settings['archiveFilename'], policy['rawManifest']['filename']]:
        raw = (seeded_source / name).read_bytes()
        expected = seeded_files[name]
        assert len(raw) == expected['bytes'] and hashlib.sha256(raw).hexdigest() == expected['sha256'], (
            f'Ownership fixtures: seeded archive input differs: {name}')
        with (seeded_archive / name).open('xb') as destination:
            destination.write(raw)
    assert seeded_files[archive_settings['archiveFilename']]['sha256'] == seeded_receipt['archiveSha256']
    shutil.copyfile(row_archive / policy['compiledPackageManifest'], seeded_archive / policy['compiledPackageManifest'])
    seeded_extracted = extracted / 'seeded'
    seeded_extracted.mkdir()
    execute('extract-seeded', [str(script_directory / 'recorded-evidence-extract.py'),
        str(seeded_archive / archive_settings['archiveFilename']), str(seeded_archive / policy['rawManifest']['filename']),
        settings['seededArchivePrefix'], str(seeded_extracted)])
    seeded_study = seeded_extracted / settings['seededArchivePrefix'] / 'study'
    assert json.loads((seeded_study / 'verification.json').read_bytes()) == seeded_receipt['result']
    scenarios = []
    for kind, study, archive, receipt, prefix in [
        ('seeded', seeded_study, seeded_archive, seeded_receipt, settings['seededArchivePrefix']),
        ('rowIsolated', row_study, row_archive, row_receipt, settings['rowArchivePrefix']),
    ]:
        index = json.loads((study / settings['sourceIndexRelativePath']).read_bytes())
        assert index['complete'] and index['harness']['identity']['sourceHash'] == policy['sourceHashes']['B']
        candidate = output / (kind + '-candidate')
        candidate.mkdir()
        for entry in index['harness']['files']:
            raw = owned_path(study / 'harness', entry['path']).read_bytes()
            assert len(raw) == entry['bytes'] and hashlib.sha256(raw).hexdigest() == entry['sha256'], (
                f'Ownership fixtures: preserved source differs: {entry["path"]}')
            target = owned_path(candidate, entry['path'])
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as destination:
                destination.write(raw)
        for name, expected in build_inputs['B'].items():
            target = owned_path(candidate, name)
            if expected is None:
                assert not target.exists()
                continue
            raw = owned_path(row_bundle / 'runtime-inputs/B', name).read_bytes()
            assert hashlib.sha256(raw).hexdigest() == expected
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists():
                assert target.read_bytes() == raw, f'Ownership fixtures: conflicting preserved input: {name}'
            else:
                with target.open('xb') as destination:
                    destination.write(raw)
        scenario_policy = {**policy, 'archive': {'filename': archive_settings['archiveFilename'], 'sha256': receipt['archiveSha256']},
            'rawManifest': {'filename': policy['rawManifest']['filename'], 'sha256': hashlib.sha256((archive / policy['rawManifest']['filename']).read_bytes()).hexdigest()},
            'archivePrefix': prefix, 'harnessSha256': index['harness']['sha256']}
        scenarios.append({'kind': kind, 'baselineRoot': str(baseline), 'candidateRoot': str(candidate),
            'archiveRoot': str(archive), 'expectedAccepted': receipt['result']['accepted'], 'policy': scenario_policy})
    evidence_output = output / settings['evidenceOutputDirectory']
    transport_output = output / settings['transportOutputDirectory']
    evidence_output.mkdir()
    transport_output.mkdir()
    (output / settings['evidenceFixtureFilename']).write_text(json.dumps({'scenarios': scenarios,
        'outputRoot': str(evidence_output)}, indent=2) + '\n')
    (output / settings['archiveFixtureFilename']).write_text(json.dumps({'sourceRoot': str(parts_root),
        'outputRoot': str(transport_output), 'expectedArchiveSha256': policy['archive']['sha256']}, indent=2) + '\n')
    return {'prepared': True, 'measurementExecuted': False, 'output': str(output), 'rowArchive': str(row_archive)}


if __name__ == '__main__':
    assert len(sys.argv) == 4, 'Ownership fixtures: provide baseline, recorded parts and fresh output directory'
    print(json.dumps(prepare(*sys.argv[1:])))
