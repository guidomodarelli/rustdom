"""Read all 33 originals of the consumed v1 run with current native transport and replay data only."""
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys

if sys.flags.optimize or sys.platform != 'linux':
    raise RuntimeError('Scientific transport qualification requires non-optimized Linux Python')
TOOL = Path('/mnt/c/Users/guido/.codex/worktrees/pilot-v2-ci-evidence/rustdom/tools/evidence-transport')
PINS = {
    'runtime.py':{'bytes':19197,'sha256':'8e13807bffe0c8aaba208643d0fb52dec4a72508f05c4f1e8a0aed0945c23ee5'},
    'stream.py':{'bytes':7981,'sha256':'ca1d27c293b2ae948724444a7ff9e463e1c27bb696d404331d5339493046dbbc'},
    'artifacts.py':{'bytes':13041,'sha256':'b5fa96de03e94b1aa55011bce4dc19fa0c42a4520f3b7b2c7ccabdc96ee37283'},
    'constants/runtime.json':{'bytes':1404,'sha256':'930b939f3450f4ea8b16c046cafa04c9ee9fa7e58a8d18642f7545a226e93e4c'},
    'constants/artifacts.json':{'bytes':667,'sha256':'d8a4a5fe855a903cd735bff2c42d45b9a8c80fd9984da5437d20af03e14bfc17'},
    'constants/loader.json':{'bytes':301,'sha256':'ce59203d2f1af95c921ce419924d045b92078abd7c59c07a4dad93677035cf8a'},
    'native-cli.lock.json':{'bytes':963,'sha256':'2b21855b0a6a763f07662f58e11ff0fb030771bb6b10746fad774306fade7472'},
}
loader_path = TOOL/'loader.py'
loader_raw = loader_path.read_bytes()
LOADER_SHA = '698d0a9a2b2edbf2217fbc4966791a14405534dc2cc8d96e902268a55edce0cd'
if len(loader_raw) != 3505 or hashlib.sha256(loader_raw).hexdigest() != LOADER_SHA:
    raise ValueError('Reviewed evidence bootstrap loader changed')
bootstrap = {'__name__':'reviewed_evidence_bootstrap','__file__':str(loader_path)}
exec(compile(loader_raw,str(loader_path),'exec'),bootstrap)
modules = bootstrap['load'](TOOL,PINS)
runtime = modules['runtime']
artifacts = modules['artifacts']

ROOT = Path('/run/rustdom-scientific-collection-v1-20261026')
SOURCE = Path('/dev/shm/rustdom-pilot-v2-published-525e2be6')
PRIMARY = Path('/mnt/c/Users/guido/ghq/projects/rustdom')
PILOT = SOURCE/'reports/benchmarks/native-class-ownership/control-precision/pilot'
RUN = 40366685759
HEAD = '1078e4fd190276a116e6dc5e64c9fe32eca3e7e9'
REVIEW_SHA = 'f85ec2b26d1839f7130a7bee4e02e560f6497f4003c7c0b2cf3f8c140402f2c1'


@contextmanager
def credentials(root):
    """Use the existing Windows credential only in memory/environment; transfer clients stay native."""
    config = root/'private-config'
    config.mkdir(mode=0o700)
    names = ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN','GH_HOST','GH_CONFIG_DIR',
        'GH_NO_UPDATE_NOTIFIER','GH_PROMPT_DISABLED','GIT_TERMINAL_PROMPT']
    previous = {name:os.environ.get(name) for name in names}
    token = subprocess.check_output(['/mnt/c/Program Files/GitHub CLI/gh.exe','auth','token','--hostname','github.com'],
        stderr=subprocess.PIPE,timeout=30).strip()
    if not token or any(part in token for part in [b'\r',b'\n',b'\x00']):
        raise ValueError('Existing GitHub credential lookup returned no single opaque token')
    try:
        for name in ['GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN']:
            os.environ.pop(name,None)
        os.environ.update(GH_TOKEN=token.decode('ascii'),GH_HOST='github.com',GH_CONFIG_DIR=str(config),
            GH_NO_UPDATE_NOTIFIER='1',GH_PROMPT_DISABLED='1',GIT_TERMINAL_PROMPT='0')
        yield token
    finally:
        for name,value in previous.items():
            if value is None:
                os.environ.pop(name,None)
            else:
                os.environ[name] = value


def retain(relative,record):
    path = ROOT/relative
    with path.open('xb') as writer:
        writer.write(json.dumps(record,indent=2).encode()+b'\n')


def remove_derived(directory,label):
    """Retire only this run's verified extraction copies, after both read-only replays finish."""
    if directory.is_symlink() or directory.resolve().parent != runtime.WORK or not directory.name.startswith('criterion-'):
        raise ValueError('Derived extraction retirement escaped the owned workspace')
    entries = []
    for filename in sorted(directory.rglob('*')):
        if filename.is_symlink():
            raise ValueError('Derived retirement contains a symlink')
        if filename.is_file():
            entries.append({'path':filename.relative_to(directory).as_posix(),'bytes':filename.stat().st_size,
                'sha256':runtime.checksum_path(filename)})
    if runtime.owned_processes():
        raise ValueError('Derived retirement requires an empty owned process subtree')
    retain(label+'-derived-retirement-intent.json',{'files':entries,'derivedCopiesOnly':True,
        'originalZipStillRetained':True,'bothReadersCompleted':True})
    shutil.rmtree(directory)
    if directory.exists():
        raise OSError('Derived extraction retirement did not complete')
    return {'derivedFiles':len(entries),'derivedBytes':sum(entry['bytes'] for entry in entries),'removedAfterBothReplays':True}


def qualify():
    ROOT.mkdir(mode=0o700,exist_ok=False)
    runtime.configure(source=SOURCE,output=ROOT/'journals',work=ROOT/'work',
        branch='feature/pilot-v2-ci-evidence',namespace='reports/validation/scientific-collection',
        native_cli=Path('/run/rustdom-native-gh-2.103.3/gh'))
    handlers = runtime.start_supervision()
    completed = []
    code = {name:pin['sha256'] for name,pin in PINS.items()}
    code['loader.py'] = LOADER_SHA
    try:
        if runtime.command(runtime.GIT+['rev-parse','HEAD'],'reader-source-head').strip() != b'4196c496187c88c92304516287a7e644659a8536':
            raise ValueError('Actual clean Linux reader source changed')
        if runtime.command(runtime.GIT+['status','--porcelain'],'reader-source-clean') != b'':
            raise ValueError('Actual Linux reader checkout is not clean')
        review_path = SOURCE/'reports/validation/jsdom-block-pilot/capture-method/review.json'
        if runtime.checksum_path(review_path) != REVIEW_SHA:
            raise ValueError('Historical reviewed reader publication differs')
        files = json.loads(review_path.read_bytes())['files']
        if len(files) != 850:
            raise ValueError('Historical reader graph size differs')
        for relative,checksum in files.items():
            if runtime.checksum_path(SOURCE/relative) != checksum:
                raise ValueError('Historical reviewed reader dependency differs: '+relative)
        sdks = {}
        for version,relative,checksum in [
            ('22.12.0','.tools/node-22/bin/node','177208bfc4a9403121a40c72d038c670f4fd937fa16ca7df0a720e90be0fe2d9'),
            ('24.14.1','.tools/node/bin/node','bf9112eb83a827dc9f9c8d19bb7bddcbf00f7b2fedae18fdcaee05406981f20a')]:
            executable = PRIMARY/relative
            if runtime.checksum_path(executable) != checksum or runtime.command([str(executable),'--version'],'sdk-'+version).strip() != ('v'+version).encode():
                raise ValueError('Pinned Node reader version/hash differs')
            sdks[version] = executable
        criteria = json.loads((PILOT/'capture/files.json').read_bytes())['criteria']
        with credentials(ROOT) as token:
            plan = artifacts.discover(run_id=RUN,source_commit=HEAD,
                workflow_path='.github/workflows/jsdom-block-pilot-capture.yml',criteria=criteria)
            retain('plan.json',plan)
            if not plan['allExpectedArtifactsAvailable'] or len(plan['records']) != 33:
                raise ValueError('The existing qualification fixture no longer has all 33 original artifacts')
            jobs = json.loads((runtime.OUTPUT/'pilot-jobs.stdout').read_bytes())['jobs']
            for job in jobs:
                artifacts.api('actions/jobs/'+str(job['id'])+'/logs','job-'+str(job['id']))
            consumption_sha = None
            for item in plan['records']:
                record = artifacts.receive(item)
                label = 'preflight' if record['ordinal'] is None else 'criterion-'+str(record['ordinal']).zfill(2)
                retain(label+'-artifact.json',record)
                original = runtime.OUTPUT/record['originalPath']
                destination = runtime.WORK/('criterion-'+label)
                if artifacts.inventory_zip(original,destination) != record['members']:
                    raise ValueError('Authenticated original changed during materialization')
                if record['ordinal'] is None:
                    consumption = destination/'capture-consumption.json'
                    receipt = json.loads(consumption.read_bytes())
                    if not receipt['allowed'] or receipt['sourceCommit'] != HEAD or receipt['currentRunId'] != RUN:
                        raise ValueError('Actual consumption receipt differs from this old consumed attempt')
                    consumption_sha = runtime.checksum_path(consumption)
                    results = []
                else:
                    criterion = criteria[record['ordinal']]
                    expected = {'mode':'capture','criterionId':criterion['criterionId'],'sourceCommit':HEAD,'files':files,
                        'requireComplete':True,'requireSupervisor':True,'runId':RUN,
                        'publicationSha256':REVIEW_SHA,'consumptionSha256':consumption_sha}
                    expected_path = destination/'expected.json'
                    if json.loads(expected_path.read_bytes()) != expected:
                        raise ValueError('Archived expected data differs from independently derived original method')
                    metadata = json.loads((destination/'archive.json').read_bytes())
                    archive = destination/'criterion.tar.gz'
                    if archive.stat().st_size != metadata['archiveBytes'] or runtime.checksum_path(archive) != metadata['archiveSha256']:
                        raise ValueError('Original tar size/digest differs')
                    extracted = destination/'capture'
                    runtime.command([sys.executable,'-B',str(PILOT/'capture/archive.py'),'--extract',str(archive),
                        metadata['archiveSha256'],str(extracted)],label+'-extract')
                    if (extracted/'index.json').exists() or (extracted/'capture-start.json').exists() or any((extracted/'workers').glob('*')):
                        raise ValueError('Existing failed fixture unexpectedly contains benchmark workers')
                    results = []
                    for version,node in sdks.items():
                        output = ROOT/(label+'-node'+version+'.json')
                        try:
                            runtime.command([str(node),str(PILOT/'capture/verify.cjs'),str(extracted),str(expected_path),
                                str(output),'--allow-partial'],label+'-node'+version)
                        except RuntimeError:
                            process = json.loads((runtime.OUTPUT/(label+'-node'+version+'.process.json')).read_bytes())
                            if process['exitCode'] != 1:
                                raise
                        else:
                            raise ValueError('An incomplete existing fixture unexpectedly passed as complete')
                        result = json.loads(output.read_bytes())
                        if result['complete'] is not False or result['reason'] != 'no-index' or result['analysis'] is not None:
                            raise ValueError('Current reader changed the historical partial result')
                        results.append({'readerNode':version,'complete':False,'reason':result['reason'],'analysis':None})
                retirement = remove_derived(destination,label)
                completed.append(dict(record,readers=results,derivedRetirement=retirement))
                retain(label+'-completed.json',completed[-1])
                print(json.dumps({'artifactId':record['id'],'ordinal':record['ordinal'],'authenticated':True,'offlineReaders':len(results)}),flush=True)
            # Scan only the new collection, in chunks with overlap; never persist or print the credential.
            for filename in ROOT.rglob('*'):
                if not filename.is_file():
                    continue
                with filename.open('rb') as reader:
                    tail = b''
                    for chunk in iter(lambda:reader.read(1048576),b''):
                        joined = tail+chunk
                        if token in joined:
                            raise RuntimeError('Credential bytes reached private evidence; do not publish')
                        tail = joined[-len(token):]
        if code != {name:runtime.checksum_path(TOOL/name) for name in code}:
            raise ValueError('Maintained transport code changed during the real collection')
        runtime.check_cancelled()
        if runtime.owned_processes():
            raise ValueError('Native collection descendants remain')
        retain('summary.json',{'dataRunId':RUN,'dataAttempt':1,'dataSourceCommit':HEAD,
            'readerSourceCommit':'4196c496187c88c92304516287a7e644659a8536','historicalReaderPinsVerified':len(files),
            'maintainedCodeSha256':code,'originalArchivesAuthenticated':len(completed),
            'originalArchiveBytes':sum(record['bytes'] for record in completed),'offlinePartialReplays':sum(len(record['readers']) for record in completed),
            'records':completed,'allOriginalZipFilesRetained':True,'allJobLogsRetained':True,
            'ownedLinuxDescendantsRemaining':[],'credentialBytesPersisted':False,
            'newDOMExecuted':False,'scientificCaptureExecuted':False,'archivedCodeExecuted':False,
            'performanceAccepted':None,'gateReevaluated':False})
        print(json.dumps({'originalArchivesAuthenticated':len(completed),'offlinePartialReplays':64,'newDOMExecuted':False}),flush=True)
    except BaseException as error:
        retain('failure.json',{'errorType':type(error).__name__,'message':str(error),
            'completedArtifacts':[record['id'] for record in completed],'newDOMExecuted':False,
            'ownedLinuxDescendantsAtFailure':runtime.owned_processes()})
        raise
    finally:
        runtime.settle_tree(terminate=True)
        for requested,handler in handlers.items():
            signal.signal(requested,handler)


if __name__ == '__main__':
    qualify()
