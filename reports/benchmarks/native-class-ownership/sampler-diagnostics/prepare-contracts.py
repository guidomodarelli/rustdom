"""Exercise output preservation and source authenticity through the real preparation CLI."""
import json
import pathlib
import subprocess
import sys


source, manifest, derived, output = map(pathlib.Path, sys.argv[1:5])
output.mkdir()
script = pathlib.Path(__file__).with_name('prepare.py')
existing = output / 'existing'
existing.mkdir()
sentinel = existing / 'sentinel.bin'
sentinel.write_bytes(b'preserve-existing-output\x00')
cases = [
    ('existing-output', source, existing),
    ('nested-output', source, source / 'diagnostic-contract-forbidden-output'),
    ('source-mismatch', derived / 'harness', output / 'must-not-be-created'),
]
results = []
for name, input_root, output_root in cases:
    process = subprocess.run([sys.executable, '-B', str(script), str(input_root), str(manifest), str(output_root)],
                             capture_output=True, text=True)
    (output / (name + '.stdout.log')).write_text(process.stdout, encoding='utf-8')
    (output / (name + '.stderr.log')).write_text(process.stderr, encoding='utf-8')
    assert process.returncode != 0, name
    if name != 'existing-output':
        assert not output_root.exists(), name
    assert sentinel.read_bytes() == b'preserve-existing-output\x00', name
    results.append({'name': name, 'exitCode': process.returncode,
                    'outputPreservedOrNotCreated': True})
(output / 'contracts.json').write_text(json.dumps({'passed': len(results), 'cases': results}, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': len(results)}))
