"""Send real signals during reaping of the real native HTTP client; no GitHub or DOM calls."""
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import threading
import time

if sys.flags.optimize or sys.platform != 'linux':
    raise RuntimeError('Native cancellation regression requires non-optimized Linux Python')
source = Path(__file__).resolve().parent.parent
script = source/'.cache/qualify-native-gh-linux.py'
expected_script = '051bf383ba06b60f4cff62d90ba35e025dcf3317a5aba2187ef75224c4ce7a9c'
if hashlib.sha256(script.read_bytes()).hexdigest() != expected_script:
    raise ValueError('Current native deadline boundary changed')
helpers_path = source/'.cache/qualify-bounded-git-transport.py'
for relative,checksum in {
    '.cache/qualify-bounded-git-transport.py':'862e03c906aea630e252042e72bac4688d1c35ded06f91c465651fcea6b7b243',
    '.cache/bounded-git-transport-policy.json':'c07202682c4781d11649cabe9f1e19f6baf62f9a3b6dfb2df345770a9b78c6e3',
    'reports/benchmarks/native-class-ownership/control-precision/pilot-v2/capture/supervise.py':'10964013affe148ca636cd25bd285f4f2ef3ad00b40dd43c159e2310380912db',
    'reports/benchmarks/native-class-ownership/control-precision/pilot-v2/constants/capture.json':'04d3d5fbcaa69b07259bb6457c1afa823f95afb0be45f4fbbdfdf54a7fd24a81',
}.items():
    if hashlib.sha256((source/relative).read_bytes()).hexdigest() != checksum:
        raise ValueError('Cancellation regression dependency changed: '+relative)
binary = Path('/run/rustdom-native-gh-2.103.3/gh')
if hashlib.sha256(binary.read_bytes()).hexdigest() != 'b768184570b12536be4ac1528893f6340d1c6a7b40b56ad45bca9cd0e87ad34d':
    raise ValueError('Native regression executable changed')
base = source/'.cache/native-gh-2.103.3-qualification/deferred-cancellation'


def current_helpers():
    namespace = {'__name__':'current_native_cancel_helpers','__file__':str(helpers_path)}
    exec(compile(helpers_path.read_bytes(),str(helpers_path),'exec'),namespace)
    return namespace


def probe(case):
    case.mkdir(exist_ok=False)
    helpers = current_helpers()
    helpers['OUTPUT'] = case
    helpers['CLEANUP_PROBE_WINDOW'] = True
    current = {'__name__':'current_native_deadline_boundary','__file__':str(script)}
    exec(compile(script.read_bytes(),str(script),'exec'),current)
    for name in ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN']:
        os.environ[name] = 'transport-local-test-token'
    os.environ['GH_HOST'] = 'github.com'
    os.environ['GH_CONFIG_DIR'] = str(case/'empty-config')
    os.environ['GH_NO_UPDATE_NOTIFIER'] = '1'
    os.environ['GH_PROMPT_DISABLED'] = '1'
    release = threading.Event()
    received = threading.Event()

    class DelayedResponse(BaseHTTPRequestHandler):
        def do_GET(self):
            received.set()
            release.wait(5)

        def log_message(self,format,*arguments):
            return

    server = HTTPServer(('127.0.0.1',0),DelayedResponse)
    thread = threading.Thread(target=server.serve_forever,kwargs={'poll_interval':0.02},daemon=False)
    handlers = helpers['start_supervision']()
    try:
        thread.start()
        address = 'http://127.0.0.1:'+str(server.server_address[1])+'/delayed'
        try:
            current['expect_native_http_timeout'](helpers,binary,address,'native-client')
        except helpers['TransportCancelled']:
            if not received.is_set() or helpers['owned_processes']():
                raise AssertionError('Cancelled real HTTP client was not received or reaped')
            receipt = {'cancelledSignal':helpers['CANCELLED_SIGNAL'],'nativeRequestReceived':True,
                'ownedLinuxDescendantsRemaining':[],'successfulQualificationWritten':False}
            (case/'cancelled.json').write_bytes(json.dumps(receipt,indent=2).encode()+b'\n')
        else:
            (case/'forbidden-success.json').write_bytes(b'{}\n')
            raise AssertionError('Deferred cancellation escaped the real qualification boundary')
    finally:
        helpers['settle_tree'](terminate=True)
        release.set()
        if thread.is_alive():
            server.shutdown()
        server.server_close()
        if thread.ident is not None:
            thread.join(timeout=5)
        for requested,handler in handlers.items():
            signal.signal(requested,handler)


def driver():
    base.mkdir(exist_ok=False)
    helpers = current_helpers()
    handlers = helpers['start_supervision']()
    records = []
    try:
        for requested in [signal.SIGTERM,signal.SIGINT]:
            case = base/str(requested.value)
            with (base/(str(requested.value)+'.stdout')).open('xb') as stdout,(base/(str(requested.value)+'.stderr')).open('xb') as stderr:
                process = subprocess.Popen([sys.executable,str(Path(__file__).resolve()),'--probe',str(case)],
                    stdout=stdout,stderr=stderr,start_new_session=True)
                try:
                    deadline = time.monotonic()+10
                    while True:
                        try:
                            marker = json.loads((case/'cleanup-entered.json').read_bytes())
                        except (FileNotFoundError,json.JSONDecodeError):
                            marker = None
                        if marker is not None:
                            break
                        if process.poll() is not None or time.monotonic() >= deadline:
                            raise AssertionError('Real native client never reached terminating cleanup')
                        time.sleep(0.02)
                    if not marker['terminating'] or not marker['owned']:
                        raise AssertionError('Cleanup signal fixture has no owned native client')
                    os.kill(process.pid,requested)
                    process.wait(timeout=15)
                    if process.returncode != 0 or (case/'forbidden-success.json').exists():
                        raise AssertionError('Cancelled qualification did not refuse success')
                    result = json.loads((case/'cancelled.json').read_bytes())
                    receipt = json.loads((case/'native-client.process.json').read_bytes())
                    if result['cancelledSignal'] != requested.value or not receipt['timedOut'] or not receipt['directChildReaped']:
                        raise AssertionError('Signal or real timeout receipt differs')
                    table = helpers['HELPERS']['processes']()
                    for identity in marker['owned']:
                        actual = table.get(identity['pid'])
                        if actual is not None and actual['startTicks'] == identity['startTicks']:
                            raise AssertionError('A cancelled native client identity still exists, including zombies')
                    records.append({'signal':requested.value,'nativeIdentitiesAbsent':marker['owned'],
                        'realHttpRequestReceived':result['nativeRequestReceived'],'successRefused':True,'probeExitCode':process.returncode})
                except BaseException:
                    helpers['settle_tree'](process,terminate=True)
                    raise
        receipt = {'qualifierSha256':expected_script,'cases':records,'GitHubInvoked':False,
            'realCredentialsRead':False,'newDOMExecuted':False,'scientificCaptureExecuted':False}
        (base/'summary.json').write_bytes(json.dumps(receipt,indent=2).encode()+b'\n')
        print(json.dumps(receipt),flush=True)
    finally:
        helpers['settle_tree'](terminate=True)
        for requested,handler in handlers.items():
            signal.signal(requested,handler)


if sys.argv[1:2] == ['--probe'] and len(sys.argv) == 3:
    probe(Path(sys.argv[2]))
elif len(sys.argv) == 1:
    driver()
else:
    raise ValueError('Unsupported native cancellation regression arguments')
