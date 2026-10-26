"""Qualify a native Linux artifact reader and real HTTP cancellation; never execute a DOM."""
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import threading

if sys.flags.optimize or sys.platform != 'linux':
    raise RuntimeError('Native CLI qualification requires non-optimized Python on Linux')


def expect_native_http_timeout(helpers,binary,address,label):
    """Require the real timeout and consume any signal deferred while reaping its client."""
    try:
        helpers['command']([str(binary),'api',address],label,timeout_seconds=0.5)
    except subprocess.TimeoutExpired:
        pass
    else:
        raise AssertionError('Real native HTTP client did not remain active until its deadline')
    helpers['check_cancelled']()


def main():
    source = Path(__file__).resolve().parent.parent
    root = source/'.cache/native-gh-2.103.3-qualification'
    output = root/'commands'
    binary = Path('/run/rustdom-native-gh-2.103.3/gh')
    binary_sha256 = 'b768184570b12536be4ac1528893f6340d1c6a7b40b56ad45bca9cd0e87ad34d'
    pins = {
        '.cache/qualify-bounded-git-transport.py':'862e03c906aea630e252042e72bac4688d1c35ded06f91c465651fcea6b7b243',
        '.cache/bounded-git-transport-policy.json':'c07202682c4781d11649cabe9f1e19f6baf62f9a3b6dfb2df345770a9b78c6e3',
        'reports/benchmarks/native-class-ownership/control-precision/pilot-v2/capture/supervise.py':'10964013affe148ca636cd25bd285f4f2ef3ad00b40dd43c159e2310380912db',
        'reports/benchmarks/native-class-ownership/control-precision/pilot-v2/constants/capture.json':'04d3d5fbcaa69b07259bb6457c1afa823f95afb0be45f4fbbdfdf54a7fd24a81',
    }
    for relative,checksum in pins.items():
        path = source/relative
        if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != checksum:
            raise ValueError('Native CLI qualification reader dependency changed: '+relative)
    if binary.is_symlink() or hashlib.sha256(binary.read_bytes()).hexdigest() != binary_sha256:
        raise ValueError('Native CLI executable differs from the authenticated installation')
    if output.exists() or output.is_symlink():
        raise FileExistsError('Native CLI qualification output already exists; preserve it unchanged')
    if any(name in os.environ for name in ['GH_DEBUG','GIT_TRACE','GIT_TRACE_CURL','GIT_CURL_VERBOSE']):
        raise RuntimeError('Native CLI qualification refuses credential-bearing debug environments')
    helper_path = source/'.cache/qualify-bounded-git-transport.py'
    helpers = {'__name__':'current_native_cli_transport_helpers','__file__':str(helper_path)}
    exec(compile(helper_path.read_bytes(),str(helper_path),'exec'),helpers)
    helpers['OUTPUT'] = output
    output.mkdir()
    private_config = Path('/run/rustdom-native-gh-2.103.3-config')
    private_config.mkdir(mode=0o700,exist_ok=False)
    scoped_names = ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN','GH_HOST',
        'GH_CONFIG_DIR','GH_NO_UPDATE_NOTIFIER','GH_PROMPT_DISABLED']
    previous_environment = {name:os.environ.get(name) for name in scoped_names}
    previous_handlers = helpers['start_supervision']()
    server = None
    server_thread = None
    release_request = threading.Event()
    request_received = threading.Event()
    fixture_auth_boundary = []
    token = None

    try:
        # This existing Windows credential lookup is short and never writes its output to a journal.
        token = subprocess.check_output(['/mnt/c/Program Files/GitHub CLI/gh.exe','auth','token','--hostname','github.com'],
            stderr=subprocess.PIPE,timeout=30).strip()
        if not token or any(character in token for character in [b'\n',b'\r',b'\x00']):
            raise ValueError('Existing GitHub credential lookup did not return one opaque token')
        os.environ['GH_TOKEN'] = token.decode('ascii')
        for name in ['GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN']:
            os.environ.pop(name,None)
        os.environ['GH_HOST'] = 'github.com'
        os.environ['GH_CONFIG_DIR'] = str(private_config)
        os.environ['GH_NO_UPDATE_NOTIFIER'] = '1'
        os.environ['GH_PROMPT_DISABLED'] = '1'
        command = helpers['command']
        if command([str(binary),'--version'],'native-version').splitlines()[0] != b'gh version 2.103.3 (2026-10-26)':
            raise ValueError('Native CLI executable version changed')
        run = json.loads(command([str(binary),'api','repos/guidomodarelli/rustdom/actions/runs/40395417183/attempts/1'],'run'))
        if run['head_sha'] != '4196c496187c88c92304516287a7e644659a8536' or run['run_attempt'] != 1 or run['status'] != 'completed':
            raise ValueError('Existing artifact qualification run identity differs')
        metadata = json.loads(command([str(binary),'api','repos/guidomodarelli/rustdom/actions/artifacts/12688950325'],'metadata'))
        if (metadata['id'] != 12688950325 or metadata['workflow_run']['id'] != 40395417183
                or metadata['workflow_run']['head_sha'] != run['head_sha'] or metadata['expired']
                or metadata['size_in_bytes'] != 104325
                or metadata['digest'] != 'sha256:4919d664557a3d4c6d9a22b1322900ebc82bf3d779c05d15df2da1eac07c061d'):
            raise ValueError('Existing artifact metadata differs from the authenticated QA fixture')
        command([str(binary),'api','repos/guidomodarelli/rustdom/actions/artifacts/12688950325/zip'],'original-zip')
        archive = output/'original-zip.stdout'
        if archive.stat().st_size != metadata['size_in_bytes'] or hashlib.sha256(archive.read_bytes()).hexdigest() != metadata['digest'][7:]:
            raise ValueError('Native CLI artifact bytes differ from the same original ZIP')

        class DelayedResponse(BaseHTTPRequestHandler):
            """A real local HTTP boundary keeps the client alive until its deadline fires."""
            def do_GET(self):
                authorization = self.headers.get('Authorization')
                fixture_auth_boundary.append(authorization is None or authorization.rsplit(' ',1)[-1] == 'transport-local-test-token')
                request_received.set()
                if not release_request.wait(5):
                    return
                try:
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b'{}\n')
                except (BrokenPipeError,ConnectionResetError):
                    # The deliberately cancelled client has closed the real socket.
                    return

            def log_message(self,format,*arguments):
                return

        os.environ['GH_TOKEN'] = 'transport-local-test-token'
        os.environ['GH_ENTERPRISE_TOKEN'] = 'transport-local-test-token'
        server = HTTPServer(('127.0.0.1',0),DelayedResponse)
        server_thread = threading.Thread(target=server.serve_forever,kwargs={'poll_interval':0.02},daemon=False)
        server_thread.start()
        address = 'http://127.0.0.1:'+str(server.server_address[1])+'/delayed'
        expect_native_http_timeout(helpers,binary,address,'native-http-deadline')
        release_request.set()
        if server_thread.is_alive():
            server.shutdown()
        server.server_close()
        server_thread.join(timeout=5)
        if server_thread.is_alive() or not request_received.is_set() or fixture_auth_boundary != [True]:
            raise AssertionError('Local HTTP cancellation boundary was incomplete or exposed a real credential')
        deadline = json.loads((output/'native-http-deadline.process.json').read_bytes())
        if not deadline['timedOut'] or not deadline['directChildReaped'] or deadline['subtree']['ownedDescendantsRemaining']:
            raise AssertionError('Native CLI cancellation left an owned Linux process')
        if helpers['owned_processes']():
            raise AssertionError('Native CLI qualification retained Linux descendants')
        for directory in [output,private_config]:
            for filename in directory.rglob('*'):
                if filename.is_file() and token in filename.read_bytes():
                    raise RuntimeError('Credential bytes appeared in private qualification files; do not publish them')
        receipt = {'nativeCliVersion':'2.103.3','nativeCliBinarySha256':binary_sha256,'nativeCliBinaryFormat':'ELF',
            'artifactId':metadata['id'],'artifactRunId':40395417183,'artifactAttempt':1,'artifactBytes':104325,
            'artifactSha256':metadata['digest'][7:],'sameExistingArchiveAuthenticated':True,
            'realNativeHttpRequestReceived':True,'realNativeHttpDeadlineSeconds':0.5,
            'nativeHttpClientDirectChildReaped':True,'ownedLinuxDescendantsRemaining':[],
            'httpServerThreadJoined':True,'realCredentialNotPassedToLocalFixture':True,
            'credentialBytesNotWrittenToJournalsOrConfig':True,'credentialLookupOutputNotJournaled':True,
            'configurationFiles':[filename.name for filename in private_config.rglob('*') if filename.is_file()],
            'scope':'CLI de transporte Linux. No prueba procesos Windows, Rust DOM, V8, memoria pico ni ausencia universal de fugas.',
            'newDOMExecuted':False,'scientificCaptureExecuted':False,'performanceAccepted':None,'gateReevaluated':False}
        helpers['check_cancelled']()
        (root/'qualification.json').write_bytes(json.dumps(receipt,indent=2,ensure_ascii=False).encode()+b'\n')
        print(json.dumps(receipt),flush=True)
    except BaseException as error:
        subtree = helpers['settle_tree'](terminate=True)
        with (root/'qualification-failure.json').open('xb') as writer:
            writer.write(json.dumps({'type':type(error).__name__,'operation':'native CLI qualification',
                'subtree':subtree,'partialEvidencePrivateUntilCredentialScan':True},indent=2).encode()+b'\n')
        raise
    finally:
        release_request.set()
        if server is not None:
            if server_thread is not None and server_thread.is_alive():
                server.shutdown()
            server.server_close()
        if server_thread is not None and server_thread.ident is not None:
            server_thread.join(timeout=5)
        for name,previous in previous_environment.items():
            if previous is None:
                os.environ.pop(name,None)
            else:
                os.environ[name] = previous
        for requested,handler in previous_handlers.items():
            signal.signal(requested,handler)



if __name__ == '__main__':
    if len(sys.argv) != 1:
        raise ValueError('Native CLI qualification accepts no arguments')
    main()
