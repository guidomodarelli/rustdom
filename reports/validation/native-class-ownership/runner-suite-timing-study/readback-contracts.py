"""Exercise the real offline reader on preserved copies of the completed study."""
import hashlib
import io
import json
import pathlib
import shutil
import subprocess
import sys
import tarfile


source = pathlib.Path(__file__).resolve().parent
output = pathlib.Path(sys.argv[1]).resolve()
assert not output.is_relative_to(source), 'Keep contract output outside the source package'
output.mkdir()
original_digest = hashlib.sha256((source / 'complete-study.tar.gz').read_bytes()).hexdigest()
results = []


def exercise(name, directory, expected_error=None):
    """Use the public CLI, preserving its actual stdout, stderr and exit status."""
    argv = [sys.executable, '-B', str(source / 'readback.py'), str(directory)]
    child = subprocess.run(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    (output / (name + '.stdout.log')).write_bytes(child.stdout)
    (output / (name + '.stderr.log')).write_bytes(child.stderr)
    if expected_error is None:
        assert child.returncode == 0, child.stderr.decode(errors='replace')
        assert json.loads(child.stdout)['suiteTimingAccepted']
    else:
        assert child.returncode != 0
        assert expected_error in child.stderr.decode(), child.stderr.decode(errors='replace')
    result = {'name': name, 'argv': argv, 'exitCode': child.returncode, 'expectedError': expected_error, 'passed': True}
    results.append(result)
    (output / (name + '-process.json')).write_text(json.dumps(result, indent=2) + '\n')


exercise('pristine', source)
for name in ['archive-checksum', 'missing-process', 'fabricated-decision', 'empty-sources']:
    directory = output / name
    directory.mkdir()
    for filename in ['receipt.json', 'raw-files.json', 'study-index.json', 'complete-study.tar.gz',
                     'readback.py', 'readback-contracts.py']:
        shutil.copyfile(source / filename, directory / filename)
    archive = directory / 'complete-study.tar.gz'
    if name == 'archive-checksum':
        payload = bytearray(archive.read_bytes())
        payload[-1] ^= 1
        archive.write_bytes(payload)
        exercise(name, directory, 'archive checksum mismatch')
        continue
    index_path = directory / 'study-index.json'
    index = json.loads(index_path.read_bytes())
    if name == 'missing-process':
        index['processes'].pop()
        expected_error = 'incomplete process ledger'
    elif name == 'fabricated-decision':
        index['decision']['suiteTimingAccepted'] = False
        expected_error = 'stored decision differs from independent calculation'
    else:
        index['sources'] = {}
        index['publication']['files'] = {}
        expected_error = 'incomplete or changed source inventory'
    payload = (json.dumps(index, indent=2) + '\n').encode()
    index_path.write_bytes(payload)
    receipt = json.loads((directory / 'receipt.json').read_bytes())
    raw_files = json.loads((directory / 'raw-files.json').read_bytes())
    raw_files['results/index.json'] = {'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()}
    (directory / 'raw-files.json').write_text(json.dumps(raw_files, indent=2) + '\n')
    replacement = directory / 'changed.tar.gz'
    with tarfile.open(archive, 'r:gz') as original, tarfile.open(replacement, 'w:gz') as rewritten:
        for member in original:
            if member.name == receipt['prefix'] + '/results/index.json':
                member.size = len(payload)
                rewritten.addfile(member, io.BytesIO(payload))
            else:
                rewritten.addfile(member, original.extractfile(member) if member.isfile() else None)
    replacement.replace(archive)
    receipt['archiveBytes'] = archive.stat().st_size
    receipt['archiveSha256'] = hashlib.sha256(archive.read_bytes()).hexdigest()
    (directory / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    exercise(name, directory, expected_error)
assert hashlib.sha256((source / 'complete-study.tar.gz').read_bytes()).hexdigest() == original_digest
summary = {'cases': results, 'measurementsExecuted': False, 'originalArchiveUnchanged': True}
(output / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps({'casesPassed': len(results), 'measurementsExecuted': False, 'output': str(output)}, indent=2))
