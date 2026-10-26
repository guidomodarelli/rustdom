"""Maintain the reviewed Git and Linux process primitives for sequential evidence transport.

Call configure once in a dedicated Linux orchestrator, then start_supervision.
The primitives retain unconfirmed clones and never retry a remote mutation.
"""
from pathlib import Path
import ctypes
import hashlib
import json
import os
import re
import selectors
import shlex
import shutil
import signal
import subprocess
import sys
import time

if sys.flags.optimize:
    raise RuntimeError('Evidence transport requires non-optimized Python')

BASE = Path(__file__).resolve().parent
POLICY = None
SOURCE = None
OUTPUT = None
WORK = None
GIT = None
REF = None
HELPERS = None
NATIVE_CLI = None
TERMINATING = False
CANCELLED_SIGNAL = None
CLEANUP_PROBE_WINDOW = False
CONFIGURED = False


def configure(*, source, output, work, branch, namespace, native_cli):
    """Bind physical paths and the independently pinned producer helpers before executing them."""
    global POLICY, SOURCE, OUTPUT, WORK, GIT, REF, HELPERS, NATIVE_CLI, CONFIGURED
    if CONFIGURED or sys.platform != 'linux':
        raise RuntimeError('Evidence transport needs one configuration in a dedicated Linux process')
    policy = json.loads((BASE/'constants/runtime.json').read_bytes())
    lock = json.loads((BASE/'native-cli.lock.json').read_bytes())
    source = Path(source)
    if source.is_symlink():
        raise ValueError('Evidence source must not be a symbolic link')
    source = source.resolve(strict=True)
    if not (source/'.git').is_dir() or (source/'.git').is_symlink():
        raise ValueError('Evidence transport requires a real Linux Git source checkout')
    if (not isinstance(branch,str) or not re.fullmatch(policy['featureBranchPattern'],branch)
            or '..' in branch or any(not part or part.startswith('.') or part.endswith(('.', '.lock')) for part in branch.split('/'))):
        raise ValueError('Evidence branch is not a canonical feature ref')
    if (not isinstance(namespace,str) or not re.fullmatch(policy['reportPathPattern'],namespace)
            or len(namespace.encode()) > policy['maximumReportPathBytes']
            or any(part in ['', '.', '..'] or part.endswith('.') for part in namespace.split('/'))):
        raise ValueError('Evidence namespace is not a canonical report path')
    output = Path(output)
    work = Path(work)
    if not output.is_absolute() or not work.is_absolute():
        raise ValueError('Evidence output/work paths must be absolute')
    if output.resolve().is_relative_to(work.resolve()) or work.resolve().is_relative_to(output.resolve()):
        raise ValueError('Evidence output and work directories must not overlap')
    for destination in [output,work]:
        if destination.exists() or destination.is_symlink():
            raise FileExistsError('Evidence runtime requires new exclusive output/work directories')
        for ancestor in destination.absolute().parents:
            if ancestor.is_symlink():
                raise ValueError('Evidence runtime output contains a symbolic link')
        if destination.resolve().is_relative_to(source):
            raise ValueError('Evidence runtime output must remain outside the producer checkout')
    for relative,checksum in policy['processHelperDependencies'].items():
        filename = source/relative
        if filename.is_symlink() or hashlib.sha256(filename.read_bytes()).hexdigest() != checksum:
            raise ValueError('Producer process helper dependency differs: '+relative)
    native_cli = Path(native_cli)
    if native_cli.is_symlink():
        raise ValueError('Native CLI must be a physical executable')
    native_cli = native_cli.resolve(strict=True)
    if native_cli.stat().st_size != lock['executable']['bytes'] or checksum_path(native_cli) != lock['executable']['sha256']:
        raise ValueError('Native CLI differs from its reviewed executable lock')
    if any(name in os.environ for name in policy['forbiddenDebugEnvironment']):
        raise RuntimeError('Evidence transport refuses credential-bearing debug environments')
    helper_path = source/policy['processHelpersPath']
    if policy['processHelpersPath'] not in policy['processHelperDependencies']:
        raise ValueError('Executable process helper is outside the pinned dependency map')
    helpers = {'__name__':'current_evidence_process_helpers','__file__':str(helper_path)}
    exec(compile(helper_path.read_bytes(),str(helper_path),'exec'),helpers)
    policy.update(branch=branch,namespace=namespace)
    output.mkdir()
    work.mkdir()
    POLICY = policy
    SOURCE = source
    OUTPUT = output.resolve()
    WORK = work.resolve()
    REF = 'refs/heads/'+branch
    HELPERS = helpers
    NATIVE_CLI = native_cli
    credential = '!'+shlex.quote(str(native_cli))+' auth git-credential'
    GIT = ['git','-c','gc.auto=0','-c','maintenance.auto=false','-c','core.autocrlf=false',
        '-c','credential.helper=','-c','credential.helper='+credential]
    CONFIGURED = True


def checksum_path(filename):
    """Hash a physical file without loading a complete archive into memory."""
    checksum = hashlib.sha256()
    with Path(filename).open('rb') as reader:
        for chunk in iter(lambda:reader.read(1048576),b''):
            checksum.update(chunk)
    return checksum.hexdigest()


class TransportCancelled(Exception):
    """Cancellation preserves all publication intents and unconfirmed local objects."""


def check_cancelled():
    """Consume a signal deferred during termination before allowing any next operation."""
    if CANCELLED_SIGNAL is not None:
        raise TransportCancelled('Transport cancelled by signal '+str(CANCELLED_SIGNAL))


def owned_processes():
    return HELPERS['owned_descendants'](HELPERS['processes']())


def start_supervision():
    """Own this Python process's subtree, including detached adopted grandchildren."""
    libc = ctypes.CDLL(None,use_errno=True)
    if libc.prctl(HELPERS['PR_SET_CHILD_SUBREAPER'],1,0,0,0) != 0:
        raise OSError(ctypes.get_errno(),'Transport cannot acquire child-subreaper ownership')
    def interrupted(received,frame):
        global CANCELLED_SIGNAL
        CANCELLED_SIGNAL = received
        if not TERMINATING:
            raise TransportCancelled('Transport cancelled by signal '+str(received))
    return {requested:signal.signal(requested,interrupted) for requested in [signal.SIGTERM,signal.SIGINT]}


def settle_tree(process=None,terminate=False):
    """Observe PID/startTicks and reap the complete owned subtree before allowing rotation."""
    global TERMINATING
    previous = TERMINATING
    TERMINATING = terminate or previous
    deadline = time.monotonic()+POLICY['terminateTimeoutSeconds']
    observed = {}
    reaped = []
    try:
        if terminate and CLEANUP_PROBE_WINDOW and not (OUTPUT/'cleanup-entered.json').exists():
            (OUTPUT/'cleanup-entered.json').write_bytes(json.dumps({'terminating':TERMINATING,
                'owned':owned_processes()}).encode()+b'\n')
            time.sleep(POLICY['negativeCleanupWindowSeconds'])
        while True:
            identities = owned_processes()
            for identity in identities:
                observed[(identity['pid'],identity['startTicks'])] = identity
            if terminate:
                HELPERS['send_owned_signal'](identities,signal.SIGKILL)
            if process is not None:
                process.poll()
            for identity in owned_processes():
                if identity['parentPid'] != os.getpid() or (process is not None and identity['pid'] == process.pid):
                    continue
                try:
                    pid,status = os.waitpid(identity['pid'],os.WNOHANG)
                    if pid: reaped.append({'pid':pid,'startTicks':identity['startTicks'],'waitStatus':status})
                except ChildProcessError:
                    pass
            if not owned_processes():
                if process is not None and process.returncode is None:
                    process.wait(timeout=max(0.001,deadline-time.monotonic()))
                return {'observed':list(observed.values()),'reapedAdoptedChildren':reaped,'ownedDescendantsRemaining':[]}
            if time.monotonic() >= deadline:
                raise RuntimeError('Owned transport descendants remain; clones and intents must be retained')
            time.sleep(POLICY['terminationPollSeconds'])
    finally:
        TERMINATING = previous


def checksum_file(filename):
    checksum = hashlib.sha256()
    with filename.open('rb') as stream:
        for chunk in iter(lambda:stream.read(POLICY['readChunkBytes']),b''):
            checksum.update(chunk)
    return checksum.hexdigest()


def stop_group(process):
    """Use the existing PID/startTicks ownership helpers, including detached descendants."""
    return settle_tree(process,terminate=True)


def command(arguments,name,cwd=None,payload=None,timeout_seconds=None):
    """Keep exact stdout/stderr and preserve every failed work directory."""
    check_cancelled()
    if cwd is None:
        cwd = SOURCE
    with (OUTPUT/(name+'.stdout')).open('xb') as stdout,(OUTPUT/(name+'.stderr')).open('xb') as stderr:
        process = subprocess.Popen(arguments,cwd=cwd,stdin=subprocess.PIPE if payload is not None else subprocess.DEVNULL,
            stdout=stdout,stderr=stderr,start_new_session=True)
        limit = POLICY['commandTimeoutSeconds'] if timeout_seconds is None else timeout_seconds
        if not 0 < limit <= POLICY['commandTimeoutSeconds']:
            stop_group(process)
            raise ValueError('Command timeout exceeds the fixed transport bound')
        timed_out = False
        tree_receipt = None
        try: process.communicate(input=payload,timeout=limit)
        except subprocess.TimeoutExpired:
            timed_out = True
            tree_receipt = stop_group(process)
            raise
        except BaseException:
            tree_receipt = stop_group(process)
            raise
        finally:
            if tree_receipt is None:
                tree_receipt = settle_tree(process)
            (OUTPUT/(name+'.process.json')).write_bytes(json.dumps({'pid':process.pid,
                'exitCode':process.returncode,'timedOut':timed_out,'directChildReaped':process.returncode is not None,
                'subtree':tree_receipt},indent=2).encode()+b'\n')
    if process.returncode != 0:
        raise RuntimeError('Git transport operation failed: '+name+'; evidence retained')
    check_cancelled()
    return (OUTPUT/(name+'.stdout')).read_bytes()


def object_id(raw):
    value = raw.decode().strip()
    if not re.fullmatch(POLICY['gitObjectPattern'],value):
        raise ValueError('Git did not return a canonical object identity')
    return value


def remote_head(name):
    raw = command(GIT+['ls-remote',POLICY['repositoryUrl'],REF],name)
    rows = raw.decode().splitlines()
    if len(rows) != 1 or rows[0].split()[1] != REF:
        raise ValueError('Evidence branch is absent or ambiguous')
    return object_id(rows[0].split()[0].encode())


def clone_bare(name,expected):
    destination = WORK/(name+'.git')
    if destination.exists() or destination.is_symlink():
        raise FileExistsError('Ephemeral Git destination already exists')
    command(GIT+['clone','--bare','--filter=blob:none','--depth=1','--single-branch','--no-tags',
        '--branch',POLICY['branch'],POLICY['repositoryUrl'],str(destination)],name+'-clone',WORK)
    if object_id(command(GIT+['rev-parse','HEAD'],name+'-head',destination)) != expected:
        raise ValueError('Evidence branch advanced during clone; retaining repository')
    if command(GIT+['config','--get','remote.origin.promisor'],name+'-promisor',destination).strip() != b'true':
        raise ValueError('Git clone is not a promisor clone')
    (destination/'.rustdom-transport-owned.json').write_bytes(json.dumps({'namespace':POLICY['namespace'],
        'workRoot':str(WORK.resolve()),'role':name}).encode())
    return destination


def read_back(repository,commit,relative,name,expected_bytes,combined):
    """Hash a lazy blob stream with a real deadline and bounded reads."""
    check_cancelled()
    checksum = hashlib.sha256()
    count = 0
    deadline = time.monotonic()+POLICY['commandTimeoutSeconds']
    with (OUTPUT/(name+'.stderr')).open('xb') as stderr:
        process = subprocess.Popen(GIT+['show',commit+':'+relative],cwd=repository,
            stdout=subprocess.PIPE,stderr=stderr,start_new_session=True)
        selector = selectors.DefaultSelector()
        selector.register(process.stdout,selectors.EVENT_READ)
        tree_receipt = None
        try:
            while True:
                remaining = deadline-time.monotonic()
                if remaining <= 0 or not selector.select(remaining):
                    raise TimeoutError('Evidence blob read deadline exceeded')
                chunk = os.read(process.stdout.fileno(),POLICY['readChunkBytes'])
                if not chunk: break
                count += len(chunk)
                if count > expected_bytes:
                    raise ValueError('Evidence blob exceeds its fixed byte bound')
                checksum.update(chunk)
                combined.update(chunk)
            process.wait(timeout=max(0.001,deadline-time.monotonic()))
            if process.returncode != 0 or count != expected_bytes:
                raise ValueError('Evidence blob read was partial or failed')
        except BaseException:
            tree_receipt = stop_group(process)
            raise
        finally:
            if tree_receipt is None:
                tree_receipt = settle_tree(process)
            (OUTPUT/(name+'.process.json')).write_bytes(json.dumps({'pid':process.pid,
                'exitCode':process.returncode,'subtree':tree_receipt},indent=2).encode()+b'\n')
            selector.close()
            process.stdout.close()
    check_cancelled()
    return checksum.hexdigest()


def cleanup_verified_clone(repository,role,confirmed_commit,confirmation):
    """Remove only this operation's disposable clones after independent remote read-back."""
    check_cancelled()
    if not confirmation or not re.fullmatch(POLICY['gitObjectPattern'],confirmed_commit):
        raise ValueError('Cleanup requires a confirmed publication')
    resolved = repository.resolve(strict=True)
    if repository.is_symlink() or resolved.parent != WORK.resolve(strict=True) or resolved.name != role+'.git':
        raise ValueError('Cleanup target escaped its exclusive transport workspace')
    marker = json.loads((resolved/'.rustdom-transport-owned.json').read_bytes())
    if marker != {'namespace':POLICY['namespace'],'workRoot':str(WORK.resolve()),'role':role}:
        raise ValueError('Cleanup target ownership marker differs')
    if command(GIT+['rev-parse','--is-bare-repository'],role+'-bare-check',resolved).strip() != b'true':
        raise ValueError('Cleanup target is not the disposable bare repository')
    size = sum(file.stat().st_size for file in resolved.rglob('*') if file.is_file())
    shutil.rmtree(resolved)
    if resolved.exists():
        raise RuntimeError('Disposable repository cleanup did not complete')
    return size


def add_metadata_tree(repository,parent,relative,blob,label):
    """Copy authenticated tree entries without hydrating the parent's missing blobs or index."""
    if (not isinstance(relative,str) or not re.fullmatch(POLICY['reportPathPattern'],relative)
            or len(relative.encode()) > POLICY['maximumReportPathBytes']
            or any(part in ['', '.', '..'] or part.endswith('.') for part in relative.split('/'))):
        raise ValueError('Evidence Git path is not a canonical portable report path')
    # This disposable writer never needs parent blob payloads. Persist the setting:
    # Git 2.34's promisor config callback does not remove an earlier true entry
    # when a later per-command false override is parsed.
    command(GIT+['config','--local','remote.origin.promisor','false'],label+'-disable-parent-hydration',repository)
    before_config = command(GIT+['config','--local','--list'],label+'-writer-policy-before',repository)
    if any(line.partition(b'=')[0].lower() == b'remote.origin.partialclonefilter' for line in before_config.splitlines()):
        command(GIT+['config','--local','--unset-all','remote.origin.partialclonefilter'],label+'-disable-parent-filter',repository)
    local_config = command(GIT+['config','--local','--list'],label+'-local-writer-policy',repository)
    if any(line.partition(b'=')[0].lower() in [b'remote.origin.partialclonefilter',b'extensions.partialclone']
           for line in local_config.splitlines()):
        raise ValueError('Disposable writer retains a configuration that enables lazy hydration')
    if command(GIT+['config','--bool','--get','remote.origin.promisor'],label+'-writer-fetch-policy',repository).strip() != b'false':
        raise ValueError('Disposable metadata writer still allows parent blob hydration')
    components = relative.split('/')
    if any(component in ['', '.', '..'] for component in components) or relative.startswith('/'):
        raise ValueError('Evidence destination is not a canonical Git path')
    root = object_id(command(GIT+['rev-parse',parent+'^{tree}'],label+'-root-tree',repository))
    def replace(tree,depth):
        entries = {}
        if tree is not None:
            raw = command(GIT+['ls-tree','-z',tree],label+'-tree-entries-'+str(depth),repository)
            for record in raw.split(b'\0'):
                if not record: continue
                metadata,name = record.split(b'\t',1)
                mode,kind,identity = metadata.split()
                if name in entries:
                    raise ValueError('Parent Git tree contains duplicate names')
                entries[name] = (mode,kind,identity)
        name = components[depth].encode()
        if depth == len(components)-1:
            if name in entries:
                raise FileExistsError('Evidence destination already exists')
            entries[name] = (b'100644',b'blob',blob.encode())
        else:
            existing = entries.get(name)
            if existing is not None and existing[0:2] != (b'040000',b'tree'):
                raise ValueError('Evidence destination traverses a non-tree entry')
            child = replace(existing[2].decode() if existing else None,depth+1)
            entries[name] = (b'040000',b'tree',child.encode())
        payload = b''.join(mode+b' '+kind+b' '+identity+b'\t'+name+b'\0'
            for name,(mode,kind,identity) in entries.items())
        # Git 2.34 inspects each entry even with --missing. Disable this command's
        # promisor fetches: existing entries are copied from the authenticated parent.
        return object_id(command(GIT+['mktree','-z','--missing'],
            label+'-new-tree-'+str(depth),repository,payload))
    tree = replace(root,0)
    differences = command(GIT+['diff-tree','--no-commit-id','--no-renames','--name-status','-r',root,tree],label+'-tree-diff',repository)
    if differences != ('A\t'+relative+'\n').encode():
        raise ValueError('Evidence tree changed more than its single new slice')
    return tree
