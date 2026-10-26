"""Prove that a real valid cached implementation cannot replace independently pinned reader bytes."""
import argparse
import hashlib
import importlib.util
import json
import marshal
from pathlib import Path
import struct
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Evidence loader qualification requires non-optimized Python')


def suite(arguments):
    root = arguments.root
    root.mkdir(exist_ok=False)
    original = Path(__file__).resolve().parent.parent
    loader_path = original/'loader.py'
    loader_raw = loader_path.read_bytes()
    if hashlib.sha256(loader_raw).hexdigest() != '698d0a9a2b2edbf2217fbc4966791a14405534dc2cc8d96e902268a55edce0cd':
        raise ValueError('Reviewed loader changed')
    bootstrap = {'__name__':'reviewed_loader_test','__file__':str(loader_path)}
    exec(compile(loader_raw,str(loader_path),'exec'),bootstrap)
    fixture = root/'own-source-fixture'
    fixture.mkdir()
    files = ['runtime.py','stream.py','artifacts.py','constants/runtime.json','constants/artifacts.json',
        'constants/loader.json','native-cli.lock.json']
    pins = {}
    for relative in files:
        raw = (original/relative).read_bytes()
        target = fixture/relative
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(raw)
        pins[relative] = {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
    marker = root/'cache-effects.txt'
    source = fixture/'runtime.py'
    status = source.stat()
    payload = ('from pathlib import Path\nwith Path('+repr(str(marker))+').open("ab") as output:\n'
        '    output.write(b"cached-implementation-executed\\n")\nCACHE_ONLY = True\n')
    code = compile(payload,str(source),'exec')
    cache = Path(importlib.util.cache_from_source(str(source)))
    cache.parent.mkdir()
    cache.write_bytes(importlib.util.MAGIC_NUMBER+struct.pack('<III',0,int(status.st_mtime),status.st_size)+marshal.dumps(code))
    control = subprocess.run([sys.executable,'-B','-c',
        'import sys;sys.path.insert(0,'+repr(str(fixture))+');import runtime;print(runtime.CACHE_ONLY)'],
        stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=15)
    (root/'control.stdout').write_bytes(control.stdout)
    (root/'control.stderr').write_bytes(control.stderr)
    if control.returncode != 0 or control.stdout.strip() != b'True' or not marker.exists():
        raise AssertionError('The innocuous timestamp/size cache fixture was not actually valid')
    previous_effect = marker.read_bytes()
    modules = bootstrap['load'](fixture,pins)
    actual = modules['runtime']
    if actual.CONFIGURED or hasattr(actual,'CACHE_ONLY') or marker.read_bytes() != previous_effect:
        raise AssertionError('Pinned reader loading executed the cached replacement')
    actual.CANCELLED_SIGNAL = 15
    try:
        actual.check_cancelled()
    except actual.TransportCancelled:
        pass
    else:
        raise AssertionError('Pinned runtime cancellation behavior did not execute')
    actual.CANCELLED_SIGNAL = None
    try:
        bootstrap['load'](fixture,pins)
    except ValueError:
        pass
    else:
        raise AssertionError('Existing transport aliases were silently replaced')
    for name,module in modules.items():
        if sys.modules.get(name) is module:
            del sys.modules[name]
    policy = fixture/'constants/artifacts.json'
    old_policy = policy.read_bytes()
    policy.write_bytes(old_policy+b' ')
    try:
        bootstrap['load'](fixture,pins)
    except ValueError:
        pass
    else:
        raise AssertionError('Changed policy executed transport modules')
    if any(name in sys.modules for name in modules) or marker.read_bytes() != previous_effect:
        raise AssertionError('Policy rejection happened after module side effects')
    policy.write_bytes(old_policy)
    incomplete = dict(pins)
    del incomplete['native-cli.lock.json']
    try:
        bootstrap['load'](fixture,incomplete)
    except ValueError:
        pass
    else:
        raise AssertionError('Incomplete policy/lock closure executed transport modules')
    if any(name in sys.modules for name in modules):
        raise AssertionError('Incomplete closure imported transport modules')
    summary = {'validTimestampBytecodeControlPassed':True,'cachedReplacementIgnoredByPinnedLoader':True,
        'actualPinnedCancellationBehaviorPassed':True,'preloadedAliasesRefused':True,
        'changedPolicyRejectedBeforeImports':True,'incompleteClosureRejectedBeforeImports':True,
        'sourcePins':pins,'loaderSha256':hashlib.sha256(loader_raw).hexdigest(),
        'newDOMExecuted':False,'GitHubInvoked':False,'realCredentialsRead':False,
        'fixturePayloadWasInnocuousAndLocal':True,'scientificCaptureExecuted':False}
    (root/'summary.json').write_bytes(json.dumps(summary,indent=2).encode()+b'\n')
    print(json.dumps({'allSixLoaderChecksPassed':True}),flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root',type=Path,required=True)
    suite(parser.parse_args())
