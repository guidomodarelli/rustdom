"""Exercise the maintained receiver on the existing authenticated archive without new measurements."""
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys

if sys.flags.optimize or sys.platform != 'linux':
    raise RuntimeError('Authenticated stream qualification requires non-optimized Linux Python')
tool = Path('/mnt/c/Users/guido/.codex/worktrees/pilot-v2-ci-evidence/rustdom/tools/evidence-transport')
sys.path.insert(0,str(tool))
import runtime
import stream

root = Path('/run/rustdom-stream-authenticated-20261026')
root.mkdir(mode=0o700,exist_ok=False)
config = root/'private-config'
config.mkdir(mode=0o700)
runtime.configure(source=Path('/dev/shm/rustdom-pilot-v2-published-525e2be6'),output=root/'journals',work=root/'work',
    branch='feature/pilot-v2-ci-evidence',namespace='reports/validation/stream-authenticated',
    native_cli=Path('/run/rustdom-native-gh-2.103.3/gh'))
handlers = runtime.start_supervision()
names = ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN','GH_HOST','GH_CONFIG_DIR',
    'GH_NO_UPDATE_NOTIFIER','GH_PROMPT_DISABLED']
previous = {name:os.environ.get(name) for name in names}
code = {relative:runtime.checksum_path(tool/relative) for relative in ['runtime.py','stream.py','constants/runtime.json','native-cli.lock.json']}
try:
    token = subprocess.check_output(['/mnt/c/Program Files/GitHub CLI/gh.exe','auth','token','--hostname','github.com'],
        stderr=subprocess.PIPE,timeout=30).strip()
    if not token or any(part in token for part in [b'\r',b'\n',b'\x00']):
        raise ValueError('Existing GitHub credential lookup did not return one opaque token')
    for name in ['GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN']:
        os.environ.pop(name,None)
    os.environ['GH_TOKEN'] = token.decode('ascii')
    os.environ['GH_HOST'] = 'github.com'
    os.environ['GH_CONFIG_DIR'] = str(config)
    os.environ['GH_NO_UPDATE_NOTIFIER'] = '1'
    os.environ['GH_PROMPT_DISABLED'] = '1'
    result = stream.download([str(runtime.NATIVE_CLI),'api','repos/guidomodarelli/rustdom/actions/artifacts/12688950325/zip'],
        'original-archive',expected_bytes=104325)
    checksum = runtime.checksum_path(result['stdout'])
    if checksum != '4919d664557a3d4c6d9a22b1322900ebc82bf3d779c05d15df2da1eac07c061d':
        raise ValueError('Authenticated stream differs from the same preserved original archive')
    for filename in root.rglob('*'):
        if filename.is_file() and token in filename.read_bytes():
            raise RuntimeError('Credential bytes reached private evidence; do not publish it')
    if code != {relative:runtime.checksum_path(tool/relative) for relative in code}:
        raise RuntimeError('Maintained receiver code changed during the authenticated read')
    runtime.check_cancelled()
    if runtime.owned_processes():
        raise AssertionError('Authenticated native client descendants remain')
    receipt = {'artifactId':12688950325,'sourceRunId':40395417183,'sourceAttempt':1,'bytes':104325,'sha256':checksum,
        'sameOriginalArchiveRead':True,'maintainedCodeSha256':code,'ownedLinuxDescendantsRemaining':[],
        'credentialBytesNotWritten':True,'configurationFiles':[path.name for path in config.rglob('*') if path.is_file()],
        'newDOMExecuted':False,'scientificCaptureExecuted':False,'performanceAccepted':None,'gateReevaluated':False}
    (root/'summary.json').write_bytes(json.dumps(receipt,indent=2).encode()+b'\n')
    print(json.dumps(receipt),flush=True)
finally:
    runtime.settle_tree(terminate=True)
    for name,value in previous.items():
        if value is None:
            os.environ.pop(name,None)
        else:
            os.environ[name] = value
    for requested,handler in handlers.items():
        signal.signal(requested,handler)
