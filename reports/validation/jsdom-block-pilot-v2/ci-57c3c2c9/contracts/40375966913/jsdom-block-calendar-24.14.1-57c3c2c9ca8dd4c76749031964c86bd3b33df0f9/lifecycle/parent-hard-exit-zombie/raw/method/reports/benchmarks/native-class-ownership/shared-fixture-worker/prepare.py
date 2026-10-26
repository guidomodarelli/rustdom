"""Derive the prospective integration while leaving all frozen input files unchanged."""
import difflib
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sys

if sys.flags.optimize:
    raise RuntimeError('Shared fixture derivation requires non-optimized Python')


def prepare(source, manifest, output):
    method = Path(__file__).resolve().parent
    shared = method.parent / 'sampler-diagnostics/prepare.py'
    spec = importlib.util.spec_from_file_location('verified_sampler_derivation', shared)
    derivation = importlib.util.module_from_spec(spec); spec.loader.exec_module(derivation)
    receipt = derivation.prepare(source, manifest, output)
    shutil.copyfile(output / 'preparation.json', output / 'base-preparation.json')
    sampler = output / 'harness/benchmarks/worker.cjs'
    before = sampler.read_text()
    content = before
    replacements = [
        ("'use strict';", "'use strict';\nconst sharedOwnershipFixtures = require('./shared-ownership-fixtures/adapter.cjs');"),
        ('function mutationRecordFixture(document, size, ancestorDepth = 0) {',
         'function mutationRecordFixture(document, size, ancestorDepth = 0) {\n'
         '  const sharedFixture = sharedOwnershipFixtures.mutation(document, size, ancestorDepth);\n'
         '  if (sharedFixture) return sharedFixture;'),
        ('function observerDeliveryFixture(document, size, name, roots) {',
         'function observerDeliveryFixture(document, size, name, roots) {\n'
         '  const sharedFixture = sharedOwnershipFixtures.delivery(document, size, name);\n'
         '  if (sharedFixture) return sharedFixture;'),
    ]
    for old, new in replacements:
        if content.count(old) != 1:
            raise ValueError('Shared fixture derivation: frozen factory layout differs')
        content = content.replace(old, new)
    sampler.write_bytes(content.encode())
    destination = output / 'harness/benchmarks/shared-ownership-fixtures'
    (destination / 'constants').mkdir(parents=True)
    candidate = method.parent / 'shared-fixture-candidate'
    for original, target in [(method / 'adapter.cjs', destination / 'adapter.cjs'),
        (candidate / 'fixtures.cjs', destination / 'fixtures.cjs'),
        (candidate / 'constants/fixtures.json', destination / 'constants/fixtures.json'),
        (method / 'worker.cjs', output / 'worker.cjs')]:
        shutil.copyfile(original, target)
    (output / 'shared-fixtures.patch').write_bytes(''.join(difflib.unified_diff(
        before.splitlines(keepends=True), content.splitlines(keepends=True),
        fromfile='original-spans/benchmarks/worker.cjs', tofile='shared-fixtures/benchmarks/worker.cjs')).encode())
    policy = json.loads((method / 'constants/protocol.json').read_text())
    receipt.update(revision=policy['revision'], functionalOnly=True, performanceAccepted=None,
        samplerAfterSha256=hashlib.sha256(sampler.read_bytes()).hexdigest(),
        changes=receipt['changes'] + ['Use shared consumer targets through two untimed fixture creation hooks'])
    receipt['derivedFiles'] = {path.relative_to(output).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(output.rglob('*')) if path.is_file() and path != output / 'preparation.json'}
    (output / 'preparation.json').write_bytes((json.dumps(receipt, indent=2) + '\n').encode())
    return receipt


if __name__ == '__main__':
    print(json.dumps(prepare(*map(Path, sys.argv[1:4]))))
