"""Round-trip two original-data slices through Git, rotating only verified ephemeral bare clones."""
from pathlib import Path
import ctypes
import hashlib
import json
import os
import re
import selectors
import shutil
import signal
import subprocess
import sys
import time

if sys.flags.optimize or os.name != 'posix':
    raise RuntimeError('Bounded Git transport qualification requires non-optimized Python on Linux')

REPOSITORY = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
SOURCE = Path('/dev/shm/rustdom-pilot-v2-published-525e2be6')
WORK = Path('/run/rustdom-bounded-git-tree-transport-20261026')
OUTPUT = REPOSITORY/'.cache/bounded-git-tree-transport-qualification'
POLICY = json.loads((REPOSITORY/'.cache/bounded-git-transport-policy.json').read_bytes())
INPUT = Path('/dev/shm/rustdom-zip-storage-qualification-525e2be6/reports/validation/jsdom-block-pilot-v2/ci-57c3c2c9/contracts/40375966913/12678701780.zip.parts/0000.bin')
GIT = ['git','-c','gc.auto=0','-c','maintenance.auto=false','-c','core.autocrlf=false']
REF = 'refs/heads/'+POLICY['branch']
HELPER_PATH = REPOSITORY/POLICY['processHelpersPath']
HELPER_BYTES = HELPER_PATH.read_bytes()
if hashlib.sha256(HELPER_BYTES).hexdigest() != POLICY['processHelpersSha256']:
    raise ValueError('Current process ownership helpers differ from the independently reviewed bytes')
HELPERS = {'__name__':'current_transport_process_helpers','__file__':str(HELPER_PATH)}
exec(compile(HELPER_BYTES,str(HELPER_PATH),'exec'),HELPERS)
TERMINATING = False
CANCELLED_SIGNAL = None
CLEANUP_PROBE_WINDOW = False


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


def command(arguments,name,cwd=SOURCE,payload=None,timeout_seconds=None):
    """Keep exact stdout/stderr and preserve every failed work directory."""
    check_cancelled()
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


def main():
    if WORK.exists() or OUTPUT.exists() or WORK.is_symlink() or INPUT.is_symlink():
        raise FileExistsError('Transport qualification requires new exclusive work/output roots and physical input')
    if INPUT.stat().st_size != POLICY['sourcePartBytes'] or checksum_file(INPUT) != POLICY['sourcePartSha256']:
        raise ValueError('Original source part differs from its preserved digest')
    if INPUT.resolve().is_relative_to(WORK.resolve()):
        raise ValueError('Source input must remain outside disposable work')
    WORK.mkdir()
    OUTPUT.mkdir()
    probe = WORK/'untouched-probe'
    probe.mkdir()
    sentinel = probe/'preserve'
    sentinel.write_bytes(b'untouched')
    try:
        cleanup_verified_clone(probe,'publish-unowned',POLICY['writerSourceCommit'],True)
        raise AssertionError('Cleanup accepted an unowned directory')
    except ValueError:
        if sentinel.read_bytes() != b'untouched':
            raise AssertionError('Cleanup rejection modified the sentinel')
    sentinel.unlink()
    probe.rmdir()
    try:
        command(['python3','-c','import time; time.sleep('+str(POLICY['negativeSleepSeconds'])+')'],
            'deadline-negative',timeout_seconds=POLICY['negativeCommandTimeoutSeconds'])
        raise AssertionError('Command deadline did not terminate the test child')
    except subprocess.TimeoutExpired:
        result = json.loads((OUTPUT/'deadline-negative.process.json').read_bytes())
        if not result['timedOut'] or not result['directChildReaped'] or result['exitCode'] == 0:
            raise AssertionError('Timed-out child was not reaped')
    check_cancelled()
    if object_id(command(GIT+['rev-parse','HEAD'],'writer-source')) != POLICY['writerSourceCommit']:
        raise ValueError('Current reviewed source checkout changed')
    if command(GIT+['status','--porcelain'],'writer-clean') != b'':
        raise ValueError('Current reviewed source checkout is not clean')
    identity_name = command(GIT+['show','-s','--format=%an',POLICY['writerSourceCommit']],'writer-name').decode().strip()
    identity_email = command(GIT+['show','-s','--format=%ae',POLICY['writerSourceCommit']],'writer-email').decode().strip()
    parent = remote_head('initial-ref')
    if parent != POLICY['expectedInitialParent']:
        raise ValueError('Evidence branch changed before this fixed qualification')
    records = []
    combined = hashlib.sha256()
    for index in range(POLICY['sourcePartBytes']//POLICY['sliceBytes']):
        label = str(index).zfill(4)
        publisher_role = 'publish-'+label
        reader_role = 'read-'+label
        publisher = clone_bare(publisher_role,parent)
        relative = POLICY['namespace']+'/slices/'+label+'.bin'
        if command(GIT+['ls-tree',parent,'--',relative],label+'-absent',publisher):
            raise FileExistsError('Evidence slice already exists; never overwrite it')
        with INPUT.open('rb') as stream:
            stream.seek(index*POLICY['sliceBytes'])
            payload = stream.read(POLICY['sliceBytes'])
        if len(payload) != POLICY['sliceBytes']:
            raise ValueError('Input slice is partial')
        checksum = hashlib.sha256(payload).hexdigest()
        blob = object_id(command(GIT+['hash-object','-w','--stdin'],label+'-blob',publisher,payload))
        del payload
        tree = add_metadata_tree(publisher,parent,relative,blob,label)
        commit = object_id(command(GIT+['-c','user.name='+identity_name,'-c','user.email='+identity_email,
            'commit-tree',tree,'-p',parent],label+'-commit',publisher,
            ('test: conservar segmento original de transporte '+label+'\n').encode()))
        intent = {'parent':parent,'commit':commit,'tree':tree,'path':relative,'bytes':POLICY['sliceBytes'],
            'sha256':checksum,'blob':blob,'automaticMutationRetries':0,'forcePush':False}
        (OUTPUT/(label+'-intent.json')).write_bytes(json.dumps(intent,indent=2).encode()+b'\n')
        if remote_head(label+'-before-push') != parent:
            raise ValueError('Concurrent evidence publication detected; preserving local commit')
        helper = '!"/mnt/c/Program Files/GitHub CLI/gh.exe" auth git-credential'
        command(GIT+['-c','credential.helper=','-c','credential.helper='+helper,'-c','pack.window=0',
            'push','--porcelain','origin',commit+':'+REF],label+'-push',publisher)
        if remote_head(label+'-after-push') != commit:
            raise ValueError('Evidence publication is unconfirmed; repositories retained')
        reader = clone_bare(reader_role,commit)
        observed = read_back(reader,commit,relative,label+'-read-back',POLICY['sliceBytes'],combined)
        if observed != checksum:
            raise ValueError('Independent remote read-back differs; repositories retained')
        if index == 0:
            try:
                read_back(reader,commit,relative,label+'-negative-byte-bound',
                    POLICY['readChunkBytes']//2,hashlib.sha256())
                raise AssertionError('Read-back accepted bytes beyond its declared bound')
            except ValueError as error:
                if str(error) != 'Evidence blob exceeds its fixed byte bound':
                    raise
            check_cancelled()
        publisher_bytes = cleanup_verified_clone(publisher,publisher_role,commit,True)
        reader_bytes = cleanup_verified_clone(reader,reader_role,commit,True)
        records.append({**intent,'independentRemoteDigestVerified':True,
            'publisherRepositoryBytes':publisher_bytes,'readerRepositoryBytes':reader_bytes,
            'bothDisposableRepositoriesRemoved':True})
        (OUTPUT/(label+'-receipt.json')).write_bytes(json.dumps(records[-1],indent=2).encode()+b'\n')
        parent = commit
    if combined.hexdigest() != POLICY['sourcePartSha256']:
        raise ValueError('Combined independent read-back differs from the original part')
    if list(WORK.iterdir()):
        raise ValueError('Transport workspace retained unexpected content')
    summary = {'policy':POLICY,'records':records,'finalEvidenceCommit':parent,
        'originalBytesRoundTripped':POLICY['sourcePartBytes'],'combinedSha256':combined.hexdigest(),
        'maximumVerifiedRepositoryPairSnapshotBytes':max(record['publisherRepositoryBytes']+record['readerRepositoryBytes'] for record in records),
        'workspaceEmptyAfterEachConfirmedPair':True,'newLargeBlobPublicationPassed':True,
        'unownedCleanupRejected':True,'realCommandDeadlineReapedChild':True,'oversizedReadRejected':True,
        'scientificCapturePreservationQualified':False,
        'scope':'Dos segmentos de 16 MiB de datos originales, publicación y lectura independientes con rotación. No valida aún colección API, ZIP/tar, replay ni todos los fallos de la captura futura.',
        'DOMExecuted':False,'scientificCaptureExecuted':False,'performanceAccepted':None,'gateReevaluated':False}
    (OUTPUT/'summary.json').write_bytes(json.dumps(summary,indent=2,ensure_ascii=False).encode()+b'\n')
    print(json.dumps(summary),flush=True)


def probe(mode,destination):
    """Exercise timeout/cancellation on a real detached grandchild without running Git or DOM."""
    global OUTPUT, CLEANUP_PROBE_WINDOW
    root = REPOSITORY/'.cache/bounded-git-transport-lifecycle'
    destination = destination.resolve(strict=False)
    if not destination.is_relative_to(root.resolve(strict=False)):
        raise ValueError('Lifecycle probe output escaped its test namespace')
    OUTPUT = destination
    OUTPUT.mkdir(parents=True,exist_ok=False)
    CLEANUP_PROBE_WINDOW = mode == 'deferred'
    code = ('import subprocess,sys,time,json,os; '
        'child=subprocess.Popen([sys.executable,"-c","import time; time.sleep(30)"],start_new_session=True); '
        'print(json.dumps({"parentPid":os.getpid(),"grandchildPid":child.pid}),flush=True); time.sleep(30)')
    if mode == 'deferred':
        try:
            command(['python3','-c',code],'probe-command',timeout_seconds=POLICY['negativeCommandTimeoutSeconds'])
        except subprocess.TimeoutExpired:
            pass
        command(['python3','-c','raise RuntimeError("Cancelled orchestration continued")'],'forbidden-after-negative')
    else:
        command(['python3','-c',code],'probe-command',timeout_seconds=
            POLICY['negativeCommandTimeoutSeconds'] if mode == 'timeout' else POLICY['commandTimeoutSeconds'])
    raise AssertionError('Lifecycle probe should have been cancelled or timed out')


if __name__ == '__main__':
    previous_handlers = start_supervision()
    try:
        if len(sys.argv) == 4 and sys.argv[1] == '--lifecycle-probe' and sys.argv[2] in ['timeout','signal','deferred']:
            probe(sys.argv[2],Path(sys.argv[3]))
        elif len(sys.argv) == 1:
            main()
        else:
            raise ValueError('Unsupported transport qualification arguments')
    except BaseException as error:
        receipt = settle_tree(terminate=True)
        if OUTPUT.is_dir():
            (OUTPUT/'orchestrator-failure.json').write_bytes(json.dumps({'type':type(error).__name__,
                'message':str(error),'cancelledSignal':CANCELLED_SIGNAL,'subtree':receipt,
                'remotePublicationOutcome':'unconfirmed after interruption; inspect intent/ref without retry',
                'automaticMutationRetries':0},indent=2).encode()+b'\n')
        raise
    finally:
        for requested,handler in previous_handlers.items():
            signal.signal(requested,handler)
