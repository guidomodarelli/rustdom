"""Derive the previously qualified sampler; only its outer report wrapper has a new study identity."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import sys

if sys.flags.optimize:
    raise RuntimeError('Shared fixture study derivation requires non-optimized Python')


def prepare(source, manifest, output):
    method = Path(__file__).resolve().parent
    filename = method.parent / 'shared-fixture-worker/prepare.py'
    spec = importlib.util.spec_from_file_location('qualified_shared_fixtures', filename)
    qualification = importlib.util.module_from_spec(spec); spec.loader.exec_module(qualification)
    receipt = qualification.prepare(source, manifest, output)
    qualified = json.loads((method.parents[2] / 'validation/native-class-ownership/shared-fixture-worker/derived/preparation.json').read_text())
    if receipt['samplerAfterSha256'] != qualified['samplerAfterSha256']:
        raise ValueError('Shared fixture study: derived sampler differs from the qualified implementation')
    shutil.copyfile(output / 'preparation.json', output / 'qualification-preparation.json')
    shutil.copyfile(output / 'worker.cjs', output / 'qualification-worker.cjs')
    shutil.copyfile(method / 'worker.cjs', output / 'worker.cjs')
    policy = json.loads((method / 'constants/protocol.json').read_text())
    receipt.update(revision=policy['revision'], purpose=policy['purpose'], functionalOnly=False,
        performanceAccepted=None, gateReevaluated=False)
    receipt['derivedFiles'] = {path.relative_to(output).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(output.rglob('*')) if path.is_file() and path != output / 'preparation.json'}
    (output / 'preparation.json').write_bytes((json.dumps(receipt, indent=2) + '\n').encode())
    return receipt


if __name__ == '__main__':
    print(json.dumps(prepare(*map(Path, sys.argv[1:4]))))
