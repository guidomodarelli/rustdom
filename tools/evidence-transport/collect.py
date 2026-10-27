"""Collect exactly one terminal v2 pilot attempt using the qualified sequential coordinator. Never dispatch a study."""
import argparse
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys

if sys.flags.optimize or sys.platform != 'linux':
    raise RuntimeError('Pilot evidence collection requires non-optimized Linux Python')

BASE = Path(__file__).resolve().parent
LOCK_SHA256 = '89dd18494ca723b0cd91cec8ea807e69877919ac8a7cdd2a52ce7ab502592ff6'


@contextmanager
def private_credentials(root, credential_cli):
    """Restore the parent environment and keep credentials out of command arguments, journals and config."""
    names = ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN','GH_HOST','GH_CONFIG_DIR',
        'GH_NO_UPDATE_NOTIFIER','GH_PROMPT_DISABLED','GIT_TERMINAL_PROMPT']
    previous = {name:os.environ.get(name) for name in names}
    config = root/'private-config'
    config.mkdir(mode=0o700)
    if credential_cli is None:
        token = (os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN') or '').encode('ascii')
    else:
        token = subprocess.check_output([str(credential_cli),'auth','token','--hostname','github.com'],
            stderr=subprocess.PIPE,timeout=30).strip()
    if not token or any(value in token for value in [b'\r',b'\n',b'\x00']):
        raise ValueError('Evidence collection requires one existing opaque GitHub credential')
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


def reject_written_credential(root, token):
    for filename in root.rglob('*'):
        if filename.is_file():
            with filename.open('rb') as reader:
                previous = b''
                for chunk in iter(lambda:reader.read(1048576),b''):
                    current = previous+chunk
                    if token in current:
                        raise RuntimeError('Credential bytes reached private evidence; publication is unsafe')
                    previous = current[-len(token):]


def collect(arguments):
    if type(arguments.run) is not int or arguments.run <= 0 or not re.fullmatch('[0-9a-f]{40}',arguments.parent):
        raise ValueError('Collection requires one explicit run ID and exact evidence branch parent')
    root = arguments.root
    if not root.is_absolute() or root.resolve().parent != Path('/run') or any(parent.is_symlink() for parent in [root,*root.parents]):
        raise ValueError('This collector requires a new physical direct child of /run')
    raw = (BASE/'constants/coordinator-reader.lock.json').read_bytes()
    if hashlib.sha256(raw).hexdigest() != LOCK_SHA256:
        raise ValueError('Qualified coordinator reader lock changed')
    lock = json.loads(raw)
    loader_path = BASE/'loader.py'
    loader_raw = loader_path.read_bytes()
    if len(loader_raw) != lock['loader']['bytes'] or hashlib.sha256(loader_raw).hexdigest() != lock['loader']['sha256']:
        raise ValueError('Qualified coordinator loader changed')
    namespace = {'__name__':'qualified_collection_bootstrap','__file__':str(loader_path)}
    exec(compile(loader_raw,str(loader_path),'exec'),namespace)
    modules = namespace['load'](BASE,lock['files'])
    runtime = modules['runtime']
    artifacts = modules['artifacts']
    replay = modules['replay']
    coordinator = modules['coordinator']
    root.mkdir(mode=0o700,exist_ok=False)
    report_prefix = arguments.namespace or ('reports/benchmarks/native-class-ownership/jsdom-block-pilot-v2-results/'+str(arguments.run))
    runtime.configure(source=arguments.source,output=root/'journals',work=root/'work',branch='feature/pilot-v2-ci-evidence',
        namespace=report_prefix,native_cli=arguments.native_cli)
    handlers = runtime.start_supervision()
    completed = []
    try:
        profile = replay.initialize_readers(arguments.primary,'current')
        with private_credentials(root,arguments.credential_cli) as token:
            if token in report_prefix.encode():
                raise ValueError('Evidence namespace contains credential bytes; publication refused')
            if runtime.remote_head('collection-initial-parent') != arguments.parent:
                raise ValueError('Evidence branch advanced before collection; preserve existing evidence')
            plan = artifacts.discover(run_id=arguments.run,source_commit=profile['dataSourceCommit'],
                workflow_path='.github/workflows/jsdom-block-pilot-v2-capture.yml',criteria=profile['criteria'])
            replay.write_json(root/'plan.json',plan)
            jobs = json.loads((runtime.OUTPUT/'pilot-jobs.stdout').read_bytes())['jobs']
            for job in jobs:
                artifacts.api('actions/jobs/'+str(job['id'])+'/logs','collection-job-'+str(job['id']))
            author = runtime.command(runtime.GIT+['show','-s','--format=%an%x00%ae',profile['dataSourceCommit']],
                'collection-existing-author').decode().strip().split('\0')
            context = {'profile':profile,'runId':arguments.run}
            parent = arguments.parent
            ordinal = 0
            for item in plan['records']:
                result,parent,ordinal = coordinator.coordinate_one(item,
                    relative_prefix=report_prefix+'/originals/'+str(item['metadata']['id'])+'/zip.parts',
                    parent=parent,author=author,ordinal=ordinal,
                    before_publication=lambda original:reject_written_credential(root,token),
                    inspect=lambda extracted, original:replay.inspect_capture(extracted,original,context))
                completed.append(result)
                replay.write_json(root/('completed-'+str(item['metadata']['id'])+'.json'),result)
                print(json.dumps({'artifactId':item['metadata']['id'],'ordinal':item['ordinal'],
                    'originalPreservedInGit':True,'bothReadersCompleted':item['ordinal'] is not None}),flush=True)
            reject_written_credential(root,token)
        runtime.check_cancelled()
        for name,pin in lock['files'].items():
            if runtime.checksum_path(BASE/name) != pin['sha256']:
                raise ValueError('Qualified collection code changed: '+name)
        if runtime.owned_processes() or runtime.command(runtime.GIT+['status','--porcelain'],'collection-source-clean-after') != b'':
            raise ValueError('Collection left native descendants or modified the reader source')
        replay.write_json(root/'summary.json',{'runId':arguments.run,'attempt':1,'sourceCommit':profile['dataSourceCommit'],
            'readerSourceCommit':lock['readerSourceCommit'],'sourceChangesNormalized':False,'sourceGitErrorsNormalized':False,
            'plan':plan,'records':completed,'finalEvidenceCommit':parent,'boundedParts':ordinal,
            'allAvailableOriginalsPreserved':len(completed) == plan['availableArtifacts'],
            'allExpectedArtifactsAvailable':plan['allExpectedArtifactsAvailable'],'ownedLinuxDescendantsRemaining':[],
            'credentialBytesPersisted':False,'newDOMExecuted':False,'archivedCodeExecuted':False,
            'performanceAccepted':None,'gateReevaluated':False})
    except BaseException as error:
        replay.write_json(root/'failure.json',{'runId':arguments.run,'attempt':1,'errorType':type(error).__name__,
            'message':str(error),'completedArtifacts':[result['original']['id'] for result in completed],
            'allUnconfirmedOriginalsAndIntentsRetained':True,'newDOMExecuted':False,
            'performanceAccepted':None,'gateReevaluated':False})
        raise
    finally:
        runtime.settle_tree(terminate=True)
        for requested,handler in handlers.items():
            signal.signal(requested,handler)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--run',type=int,required=True)
    parser.add_argument('--parent',required=True)
    for name in ['root','source','primary','native-cli']:
        parser.add_argument('--'+name,type=Path,required=True)
    parser.add_argument('--credential-cli',type=Path)
    parser.add_argument('--namespace')
    collect(parser.parse_args())
