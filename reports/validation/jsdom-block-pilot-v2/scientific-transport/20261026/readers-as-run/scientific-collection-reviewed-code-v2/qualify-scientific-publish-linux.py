"""Round-trip the existing 111MB CI ZIP through the maintained native publisher; no DOM or new study."""
import hashlib
import json
from pathlib import Path
import signal
import sys

if sys.flags.optimize or sys.platform != 'linux':
    raise RuntimeError('Native evidence publication qualification requires non-optimized Linux Python')
repository = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
tool = Path('/mnt/c/Users/guido/.codex/worktrees/pilot-v2-ci-evidence/rustdom/tools/evidence-transport')
helper_path = repository/'.cache/qualify-scientific-collection-linux-v2.py'
helper_raw = helper_path.read_bytes()
helper_sha = '23867d1946b93e4f9d14217dc6b5ed23ff103f7e232f9b9faf5d0cbfd2bc59df'
publisher_path = tool/'publish.py'
publisher_raw = publisher_path.read_bytes()
publisher_sha = 'b61c64e36a4b9336c738ac63c8bb903c6f159e937f2e39ed056327b2e9b3a121'
if hashlib.sha256(helper_raw).hexdigest() != helper_sha or len(publisher_raw) != 4962 or hashlib.sha256(publisher_raw).hexdigest() != publisher_sha:
    raise ValueError('Current reviewed publication bootstrap changed')
current = {'__name__':'current_reviewed_transport_bootstrap','__file__':str(helper_path)}
exec(compile(helper_raw,str(helper_path),'exec'),current)
runtime = current['runtime']
artifacts = current['artifacts']
publisher = {'__name__':'current_reviewed_publisher','__file__':str(publisher_path)}
exec(compile(publisher_raw,str(publisher_path),'exec'),publisher)
root = Path('/run/rustdom-scientific-publish-20261026')
root.mkdir(mode=0o700,exist_ok=False)
runtime.configure(source=Path('/dev/shm/rustdom-pilot-v2-published-525e2be6'),output=root/'journals',work=root/'work',
    branch='feature/pilot-v2-ci-evidence',namespace='reports/validation/jsdom-block-pilot-v2/scientific-transport/20261026/roundtrip',
    native_cli=Path('/run/rustdom-native-gh-2.103.3/gh'))
handlers = runtime.start_supervision()
try:
    if runtime.command(runtime.GIT+['rev-parse','HEAD'],'source-head').strip() != b'4196c496187c88c92304516287a7e644659a8536':
        raise ValueError('Reviewed source commit changed')
    if runtime.command(runtime.GIT+['status','--porcelain'],'source-clean') != b'':
        raise ValueError('Reviewed source checkout changed')
    original = Path('/run/rustdom-ci-4196-artifacts-20261026/journals/zip-12688150146.stdout')
    if original.stat().st_size != 111209731 or runtime.checksum_path(original) != '914dccda28284f206e1e077f9805e652f66209694ef7c7bbe405c520ed2ecff7':
        raise ValueError('Original current CI ZIP differs from the already published archive')
    with current['credentials'](root) as token:
        metadata = json.loads(artifacts.api('actions/artifacts/12688150146','original-metadata'))
        if (metadata['workflow_run']['id'] != 40395417183 or metadata['workflow_run']['head_sha'] != '4196c496187c88c92304516287a7e644659a8536'
                or metadata['size_in_bytes'] != 111209731 or metadata['digest'] != 'sha256:'+runtime.checksum_path(original)):
            raise ValueError('Original archive API provenance differs')
        parent = runtime.remote_head('initial-parent')
        if parent != 'c417eebf65efd30bf474bd3cacd1e8e15d953010':
            raise ValueError('Evidence branch changed before the single transport qualification')
        author = runtime.command(runtime.GIT+['show','-s','--format=%an%x00%ae','4196c496187c88c92304516287a7e644659a8536'],
            'existing-author').decode().strip().split('\0')
        record,final,ordinal = publisher['publish_file'](original,runtime.POLICY['namespace']+'/12688150146/zip.parts',parent,author,0)
        if ordinal != 4 or len(record['parts']) != 4 or not record['wholeRemoteDigestVerified']:
            raise ValueError('Native publication did not round-trip the four bounded original parts')
        for filename in root.rglob('*'):
            if filename.is_file():
                with filename.open('rb') as reader:
                    tail = b''
                    for chunk in iter(lambda:reader.read(1048576),b''):
                        joined = tail+chunk
                        if token in joined:
                            raise RuntimeError('Credential bytes reached publication evidence; do not publish')
                        tail = joined[-len(token):]
    runtime.check_cancelled()
    if runtime.owned_processes():
        raise ValueError('Native Git publication descendants remain')
    if runtime.checksum_path(helper_path) != helper_sha or runtime.checksum_path(publisher_path) != publisher_sha:
        raise ValueError('Reviewed publication bootstrap changed during transport')
    summary = {'artifactId':12688150146,'dataRunId':40395417183,'dataAttempt':1,
        'sourceCommit':'4196c496187c88c92304516287a7e644659a8536','initialParent':parent,'finalEvidenceCommit':final,
        'record':record,'parts':ordinal,'nativeCliUsedForGitCredentials':True,
        'independentRemoteReadbackForEveryPart':True,'allEightDisposableGitRepositoriesRemoved':True,
        'ownedLinuxDescendantsRemaining':[],'credentialBytesPersisted':False,
        'publisherSha256':publisher_sha,'bootstrapSha256':helper_sha,
        'newDOMExecuted':False,'scientificCaptureExecuted':False,'performanceAccepted':None,'gateReevaluated':False}
    (root/'summary.json').write_bytes(json.dumps(summary,indent=2).encode()+b'\n')
    print(json.dumps({'parts':ordinal,'finalEvidenceCommit':final,'wholeOriginalVerified':True}),flush=True)
except BaseException as error:
    (root/'failure.json').write_bytes(json.dumps({'errorType':type(error).__name__,'message':str(error),
        'retainedAllUnconfirmedCommitsAndIntents':True,'ownedLinuxDescendantsAtFailure':runtime.owned_processes(),
        'newDOMExecuted':False},indent=2).encode()+b'\n')
    raise
finally:
    runtime.settle_tree(terminate=True)
    for requested,handler in handlers.items():
        signal.signal(requested,handler)
