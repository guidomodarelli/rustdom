"""Exercise the real native HTTP client, archive bytes, boundaries and cancellation on Linux."""
import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import resource
import signal
import subprocess
import sys
import threading
import time

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import runtime
import stream


def fixture_environment(root):
    for name in ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN']:
        os.environ[name] = 'transport-local-test-token'
    os.environ['GH_HOST'] = 'github.com'
    os.environ['GH_CONFIG_DIR'] = str(root/'empty-config')
    os.environ['GH_NO_UPDATE_NOTIFIER'] = '1'
    os.environ['GH_PROMPT_DISABLED'] = '1'


def service(small,large):
    state = {'requests':[],'delayReceived':threading.Event(),'releaseDelay':threading.Event(),'delayFinished':threading.Event()}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            state['requests'].append(self.path)
            if self.path == '/delay':
                state['delayReceived'].set()
                state['releaseDelay'].wait(5)
                state['delayFinished'].set()
                return
            if self.path == '/connection-error':
                return
            path = large if self.path == '/large' else small
            adjustment = -1 if self.path == '/short' else (1 if self.path == '/long' else 0)
            self.send_response(200)
            self.send_header('Content-Type','application/octet-stream')
            self.send_header('Content-Length',str(path.stat().st_size+adjustment))
            self.end_headers()
            remaining = path.stat().st_size+min(adjustment,0)
            try:
                with path.open('rb') as reader:
                    while remaining:
                        chunk = reader.read(min(1048576,remaining))
                        if not chunk:
                            raise RuntimeError('Real fixture input became partial')
                        self.wfile.write(chunk)
                        remaining -= len(chunk)
                if adjustment == 1:
                    self.wfile.write(b'!')
            except (BrokenPipeError,ConnectionResetError):
                # Byte-bound rejection deliberately closes the real client socket.
                return

        def log_message(self,format,*arguments):
            return

    server = HTTPServer(('127.0.0.1',0),Handler)
    thread = threading.Thread(target=server.serve_forever,kwargs={'poll_interval':0.02},daemon=False)
    thread.start()
    return server,thread,state


def bind(arguments,root):
    root.mkdir()
    fixture_environment(root)
    runtime.configure(source=arguments.source,output=root/'journals',work=root/'work',
        branch='feature/pilot-v2-ci-evidence',namespace='reports/validation/stream-qualification',native_cli=arguments.cli)
    return runtime.start_supervision()


def stop_service(server,thread,state):
    state['releaseDelay'].set()
    if thread.is_alive():
        server.shutdown()
    server.server_close()
    thread.join(timeout=5)
    if thread.is_alive():
        raise AssertionError('Real HTTP fixture thread remained active')


def probe(arguments):
    root = Path(arguments.root)
    handlers = bind(arguments,root)
    runtime.CLEANUP_PROBE_WINDOW = True
    server,thread,state = service(Path(arguments.small),Path(arguments.large))
    address = 'http://127.0.0.1:'+str(server.server_address[1])+'/delay'
    try:
        try:
            stream.download([str(runtime.NATIVE_CLI),'api',address],'native-client',expected_bytes=1,timeout_seconds=0.2)
        except subprocess.TimeoutExpired:
            (root/'forbidden-success.json').write_bytes(b'{}\n')
            raise AssertionError('Expected timeout consumed the deferred cancellation')
        except runtime.TransportCancelled:
            if not state['delayReceived'].is_set() or runtime.owned_processes():
                raise AssertionError('Cancelled real native client was not received or reaped')
            try:
                runtime.command([str(runtime.NATIVE_CLI),'--version'],'forbidden-next')
            except runtime.TransportCancelled:
                pass
            else:
                raise AssertionError('A command ran after deferred cancellation')
            (root/'cancelled.json').write_bytes(json.dumps({'signal':runtime.CANCELLED_SIGNAL,
                'realHttpRequestReceived':True,'successRefused':True,'nextCommandRefused':True}).encode()+b'\n')
        else:
            raise AssertionError('A delayed request unexpectedly completed')
    finally:
        runtime.settle_tree(terminate=True)
        stop_service(server,thread,state)
        for requested,handler in handlers.items():
            signal.signal(requested,handler)


def suite(arguments):
    root = Path(arguments.root)
    handlers = bind(arguments,root)
    small = Path(arguments.small)
    large = Path(arguments.large)
    if small.stat().st_size != 104325 or runtime.checksum_path(small) != '4919d664557a3d4c6d9a22b1322900ebc82bf3d779c05d15df2da1eac07c061d':
        raise ValueError('Existing small artifact differs from its authenticated fixture')
    if large.stat().st_size != 111209731 or runtime.checksum_path(large) != '914dccda28284f206e1e077f9805e652f66209694ef7c7bbe405c520ed2ecff7':
        raise ValueError('Existing large artifact differs from its authenticated fixture')
    server,thread,state = service(small,large)
    base = 'http://127.0.0.1:'+str(server.server_address[1])
    records = []

    def run(path,label,size,timeout=5):
        return stream.download([str(runtime.NATIVE_CLI),'api',base+path],label,
            expected_bytes=size,timeout_seconds=timeout)

    try:
        head = runtime.command(runtime.GIT+['rev-parse','HEAD'],'actual-source-head').decode().strip()
        if head != '4196c496187c88c92304516287a7e644659a8536':
            raise AssertionError('Command default cwd did not use the real candidate Git checkout')
        records.append({'case':'candidate-source-cwd','passed':True})
        result = run('/small','small',small.stat().st_size)
        if runtime.checksum_path(result['stdout']) != runtime.checksum_path(small):
            raise AssertionError('Native binary archive stream changed bytes')
        records.append({'case':'small-original-archive','bytes':small.stat().st_size,'passed':True})
        before = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024
        result = run('/large','large',large.stat().st_size,120)
        after = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss*1024
        if runtime.checksum_path(result['stdout']) != runtime.checksum_path(large):
            raise AssertionError('Large native binary stream changed bytes')
        if after-before >= large.stat().st_size//2:
            raise AssertionError('Collector parent retained an archive-sized allocation during the large transfer')
        records.append({'case':'large-original-archive','bytes':large.stat().st_size,
            'parentHighWaterRssBeforeBytes':before,'parentHighWaterRssAfterBytes':after,
            'scope':'Linux Python parent high-water RSS only; excludes native client and Rust DOM.','passed':True})
        count = len(state['requests'])
        try:
            run('/small','small',small.stat().st_size)
        except FileExistsError:
            pass
        else:
            raise AssertionError('Duplicate operation overwrote its original bytes')
        if len(state['requests']) != count:
            raise AssertionError('Duplicate operation started a real HTTP request')
        records.append({'case':'duplicate-operation-before-client-start','passed':True})
        for size in [True,0,-1,runtime.POLICY['maximumArchiveBytes']+1]:
            try:
                run('/small','invalid-size',size)
            except ValueError:
                pass
            else:
                raise AssertionError('Invalid metadata size was accepted')
        if (runtime.OUTPUT/'invalid-size').exists() or len(state['requests']) != count:
            raise AssertionError('Invalid size changed outputs or reached the client')
        records.append({'case':'invalid-metadata-sizes-before-side-effects','passed':True})
        try:
            run('/short','short',small.stat().st_size)
        except ValueError:
            pass
        else:
            raise AssertionError('Incomplete archive was accepted')
        if (runtime.OUTPUT/'short/stdout.bin').stat().st_size != small.stat().st_size-1:
            raise AssertionError('Incomplete archive partial bytes were not preserved')
        records.append({'case':'incomplete-archive-preserved-and-rejected','passed':True})
        try:
            run('/long','long',small.stat().st_size)
        except stream.TransferLimitExceeded:
            pass
        else:
            raise AssertionError('Oversized archive was accepted')
        if (runtime.OUTPUT/'long/stdout.bin').stat().st_size != small.stat().st_size:
            raise AssertionError('Archive byte limit was exceeded on disk')
        records.append({'case':'stdout-hard-byte-bound','passed':True})
        original_limit = runtime.POLICY['maximumStderrBytes']
        runtime.POLICY['maximumStderrBytes'] = 32
        try:
            try:
                run('/connection-error','stderr-bound',1)
            except stream.TransferLimitExceeded:
                pass
            else:
                raise AssertionError('Real CLI stderr exceeded the test-only byte bound')
        finally:
            runtime.POLICY['maximumStderrBytes'] = original_limit
        if (runtime.OUTPUT/'stderr-bound/stderr.bin').stat().st_size != 32:
            raise AssertionError('CLI stderr byte boundary was not exact')
        records.append({'case':'stderr-hard-byte-bound','testOnlyLimitBytes':32,'passed':True})
        try:
            run('/delay','deadline',1,0.2)
        except subprocess.TimeoutExpired:
            pass
        else:
            raise AssertionError('Real pending HTTP request ignored its deadline')
        if not state['delayReceived'].is_set() or runtime.owned_processes():
            raise AssertionError('Timed-out native client was not received or reaped')
        state['releaseDelay'].set()
        if not state['delayFinished'].wait(5):
            raise AssertionError('Timed-out fixture did not close')
        records.append({'case':'real-native-http-deadline','passed':True})
    finally:
        runtime.settle_tree(terminate=True)
        stop_service(server,thread,state)
    try:
        for requested in [signal.SIGTERM,signal.SIGINT]:
            case = root/('signal-'+str(requested.value))
            args = [sys.executable,str(Path(__file__).resolve()),'--probe','--source',str(arguments.source),
                '--root',str(case),'--cli',str(arguments.cli),'--small',str(small),'--large',str(large)]
            with (root/(str(requested.value)+'.stdout')).open('xb') as stdout,(root/(str(requested.value)+'.stderr')).open('xb') as stderr:
                process = subprocess.Popen(args,stdout=stdout,stderr=stderr,start_new_session=True)
                try:
                    deadline = time.monotonic()+10
                    while True:
                        try:
                            marker = json.loads((case/'journals/cleanup-entered.json').read_bytes())
                        except (FileNotFoundError,json.JSONDecodeError):
                            marker = None
                        if marker is not None:
                            break
                        if process.poll() is not None or time.monotonic() >= deadline:
                            raise AssertionError('Native streaming client did not enter terminating cleanup')
                        time.sleep(0.02)
                    if not marker['terminating'] or not marker['owned']:
                        raise AssertionError('Streaming cancellation fixture has no live owned client')
                    os.kill(process.pid,requested)
                    process.wait(timeout=15)
                    if process.returncode != 0 or (case/'forbidden-success.json').exists() or (case/'journals/forbidden-next.stdout').exists():
                        raise AssertionError('Deferred cancellation did not refuse success and the next command')
                    record = json.loads((case/'cancelled.json').read_bytes())
                    if record['signal'] != requested.value:
                        raise AssertionError('Deferred signal identity differs')
                    table = runtime.HELPERS['processes']()
                    for identity in marker['owned']:
                        actual = table.get(identity['pid'])
                        if actual is not None and actual['startTicks'] == identity['startTicks']:
                            raise AssertionError('Cancelled native identity remains, including zombies')
                    records.append({'case':'deferred-signal-'+str(requested.value),'nativeIdentitiesAbsent':marker['owned'],'passed':True})
                except BaseException:
                    runtime.settle_tree(process,terminate=True)
                    raise
        result = {'cases':records,'GitHubInvoked':False,'realCredentialsRead':False,'newDOMExecuted':False,
            'scientificCaptureExecuted':False,'universalLeakAbsenceProven':False,'rustDomPeakMemoryMeasured':False}
        (root/'summary.json').write_bytes(json.dumps(result,indent=2).encode()+b'\n')
        print(json.dumps(result),flush=True)
    finally:
        runtime.settle_tree(terminate=True)
        for requested,handler in handlers.items():
            signal.signal(requested,handler)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--probe',action='store_true')
    for name in ['source','root','cli','small','large']:
        parser.add_argument('--'+name,type=Path,required=True)
    arguments = parser.parse_args()
    if arguments.probe:
        probe(arguments)
    else:
        suite(arguments)
