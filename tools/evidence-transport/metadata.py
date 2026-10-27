"""Prepend a bounded HANDOFF section through isolated Git clients, preserving every byte of prior content.

The caller authenticates this module/policy separately and supplies the already qualified runtime.
The frozen coordinator and full-study reader closure remain unchanged.
"""
import hashlib
import json
from pathlib import Path
import re

POLICY = json.loads((Path(__file__).resolve().parent/'constants/metadata.json').read_bytes())


def prepend_document(original, section):
    """Insert one heading after the existing title; retain prior title/body exactly, including line endings."""
    if (not isinstance(original,bytes) or not isinstance(section,bytes)
            or not 0 < len(original) <= POLICY['maximumHandoffBytes']
            or not 0 < len(section) <= POLICY['maximumSectionBytes']):
        raise ValueError('Handoff input or section exceeds its fixed byte bound')
    original.decode('utf8')
    section.decode('utf8')
    if (b'\x00' in original or b'\x00' in section or b'\r' in section
            or not original.startswith(b'# ') or b'\n' not in original
            or not section.startswith(POLICY['sectionPrefix'].encode()) or not section.endswith(b'\n\n')):
        raise ValueError('Handoff requires a UTF-8 title and a canonical complete new section')
    split = original.index(b'\n')+1
    combined = original[:split]+b'\n'+section+original[split:]
    if len(combined) > POLICY['maximumHandoffBytes']:
        raise ValueError('Combined handoff exceeds its fixed byte bound')
    return combined


def write_receipt(filename, value):
    """Never replace another publication intent, readback or refusal receipt."""
    with filename.open('xb') as writer:
        writer.write(json.dumps(value,indent=2).encode()+b'\n')


def repository_bytes(repository):
    return sum(filename.stat().st_size for filename in repository.rglob('*') if filename.is_file())


def metadata_only_repository(runtime, repository, label, allowed_blobs):
    """Enumerate local objects only; reject hydrated blobs outside the declared small text inputs."""
    freeze_blob_hydration(runtime,repository,label+'-freeze')
    if repository_bytes(repository) > POLICY['maximumRepositoryBytes']:
        raise ValueError('Isolated handoff repository exceeds its metadata-only storage bound')
    raw = runtime.command(runtime.GIT+['cat-file','--batch-all-objects','--batch-check'],label+'-local-objects',repository)
    blobs = {}
    for line in raw.splitlines():
        identity,kind,size = line.split()
        if kind == b'blob':
            oid = identity.decode()
            if oid not in allowed_blobs or int(size) > POLICY['maximumHandoffBytes']:
                raise ValueError('Handoff client hydrated an undeclared or oversized blob')
            blobs[oid] = int(size)
    return {'localBlobSizes':blobs,'repositoryBytesSnapshot':repository_bytes(repository),
        'snapshotIsPeakMemory':False,'benchmarkBlobHydrationPerformed':False}


def verify_handoff_input(runtime, repository, parent, expected_blob, original, label):
    """Bind supplied old bytes to the real parent entry without hydrating any parent blob."""
    path = POLICY['handoffPath']
    record = runtime.command(runtime.GIT+['ls-tree',parent,'--',path],label+'-old-entry',repository).split()
    if len(record) != 4 or record[:2] != [b'100644',b'blob'] or record[2].decode() != expected_blob or record[3].decode() != path:
        raise ValueError('Current handoff entry differs from the independently selected old blob')
    computed = runtime.object_id(runtime.command(runtime.GIT+['hash-object','--stdin'],label+'-old-identity',repository,original))
    if computed != expected_blob:
        raise ValueError('Supplied handoff bytes differ from the actual parent Git object')


def freeze_blob_hydration(runtime, repository, label):
    """Mirror the frozen core's proven guard, changing only this operation's disposable client."""
    runtime.command(runtime.GIT+['config','--local','remote.origin.promisor','false'],label+'-disable-hydration',repository)
    config = runtime.command(runtime.GIT+['config','--local','--list'],label+'-config-before',repository)
    if any(line.partition(b'=')[0].lower() == b'remote.origin.partialclonefilter' for line in config.splitlines()):
        runtime.command(runtime.GIT+['config','--local','--unset-all','remote.origin.partialclonefilter'],label+'-disable-filter',repository)
    config = runtime.command(runtime.GIT+['config','--local','--list'],label+'-config-after',repository)
    if (any(line.partition(b'=')[0].lower() in [b'remote.origin.partialclonefilter',b'extensions.partialclone'] for line in config.splitlines())
            or runtime.command(runtime.GIT+['config','--bool','--get','remote.origin.promisor'],label+'-hydration-policy',repository).strip() != b'false'):
        raise ValueError('Isolated metadata writer still permits parent blob hydration')


def replace_handoff_tree(runtime, repository, parent, expected_blob, new_blob, label):
    """Rebuild only this path; frozen parent trees and unrelated raw benchmark blobs stay unhydrated."""
    freeze_blob_hydration(runtime,repository,label)
    components = POLICY['handoffPath'].split('/')
    root = runtime.object_id(runtime.command(runtime.GIT+['rev-parse',parent+'^{tree}'],label+'-root-tree',repository))

    def replace(tree, depth):
        entries = {}
        for record in runtime.command(runtime.GIT+['ls-tree','-z',tree],label+'-entries-'+str(depth),repository).split(b'\0'):
            if not record:
                continue
            metadata,name = record.split(b'\t',1)
            mode,kind,identity = metadata.split()
            if name in entries:
                raise ValueError('Parent metadata tree contains duplicate names')
            entries[name] = (mode,kind,identity)
        name = components[depth].encode()
        existing = entries.get(name)
        if depth == len(components)-1:
            if existing != (b'100644',b'blob',expected_blob.encode()):
                raise ValueError('Handoff changed before guarded tree replacement')
            entries[name] = (b'100644',b'blob',new_blob.encode())
        else:
            if existing is None or existing[:2] != (b'040000',b'tree'):
                raise ValueError('Handoff ancestor is absent or not a tree')
            child = replace(existing[2].decode(),depth+1)
            entries[name] = (b'040000',b'tree',child.encode())
        payload = b''.join(mode+b' '+kind+b' '+identity+b'\t'+name+b'\0'
            for name,(mode,kind,identity) in entries.items())
        return runtime.object_id(runtime.command(runtime.GIT+['mktree','-z','--missing'],label+'-tree-'+str(depth),repository,payload))

    tree = replace(root,0)
    if runtime.command(runtime.GIT+['diff-tree','--no-commit-id','--no-renames','--name-status','-r',root,tree],label+'-exact-diff',repository) != ('M\t'+POLICY['handoffPath']+'\n').encode():
        raise ValueError('Handoff tree changed more than its single selected text path')
    return tree


def publish_handoff(runtime, *, parent, expected_old_blob, expected_old_sha256, original, section, author, ordinal, current_credential):
    """Publish one exact prepend with no retries; retain unconfirmed repositories and intents on any failure."""
    if (runtime.POLICY['branch'] != POLICY['branch'] or runtime.REF != 'refs/heads/'+POLICY['branch']
            or type(ordinal) is not int or not 0 <= ordinal <= POLICY['maximumOrdinal']
            or any(not isinstance(value,str) or not re.fullmatch(runtime.POLICY['gitObjectPattern'],value) for value in [parent,expected_old_blob])
            or not isinstance(expected_old_sha256,str) or not re.fullmatch('[0-9a-f]{64}',expected_old_sha256)
            or not isinstance(author,(list,tuple)) or len(author) != 2
            or not all(isinstance(value,str) and value and '\n' not in value and '\x00' not in value for value in author)
            or not isinstance(current_credential,bytes) or not current_credential):
        raise ValueError('Handoff publication branch, identity, author or credential guard is invalid')
    combined = prepend_document(original,section)
    if hashlib.sha256(original).hexdigest() != expected_old_sha256:
        raise ValueError('Supplied old handoff differs from its independent SHA256 before any network operation')
    if current_credential in combined or any(current_credential in value.encode() for value in author):
        raise ValueError('Handoff document or author contains current credential bytes')
    label = POLICY['rolePrefix']+str(ordinal).zfill(5)
    if runtime.remote_head(label+'-initial-ref') != parent:
        raise ValueError('Evidence branch advanced before the handoff publication')
    writer_role = label+'-write'
    reader_role = label+'-read'
    repository = runtime.clone_bare(writer_role,parent)
    verify_handoff_input(runtime,repository,parent,expected_old_blob,original,label)
    blob = runtime.object_id(runtime.command(runtime.GIT+['hash-object','-w','--stdin'],label+'-new-blob',repository,combined))
    tree = replace_handoff_tree(runtime,repository,parent,expected_old_blob,blob,label)
    writer_scope = metadata_only_repository(runtime,repository,label+'-writer-scope',{blob})
    commit = runtime.object_id(runtime.command(runtime.GIT+['-c','user.name='+author[0],'-c','user.email='+author[1],
        'commit-tree',tree,'-p',parent],label+'-commit',repository,b'chore: actualizar handoff preservando evidencia\n'))
    receipt = {'parent':parent,'commit':commit,'tree':tree,'path':POLICY['handoffPath'],'oldBlob':expected_old_blob,
        'oldSha256':expected_old_sha256,'newBlob':blob,'bytes':len(combined),'sha256':hashlib.sha256(combined).hexdigest(),
        'oldTitleAndBodyPreservedByteForByte':True,'onlyDeclaredSectionInserted':True,
        'writerScope':writer_scope,'automaticMutationRetries':0,'forcePush':False}
    write_receipt(runtime.OUTPUT/(label+'-intent.json'),receipt)
    if runtime.remote_head(label+'-before-push') != parent:
        raise ValueError('Evidence branch changed after handoff intent; retain the unpushed commit')
    runtime.command(runtime.GIT+['-c','pack.window=0','push','--porcelain','origin',commit+':'+runtime.REF],label+'-push',repository)
    if runtime.remote_head(label+'-after-push') != commit:
        raise ValueError('Handoff publication is unconfirmed; retain all local objects')
    reader = runtime.clone_bare(reader_role,commit)
    observed = runtime.read_back(reader,commit,POLICY['handoffPath'],label+'-readback',len(combined),hashlib.sha256())
    if observed != receipt['sha256']:
        raise ValueError('Independent remote handoff readback differs; retain all objects')
    reader_scope = metadata_only_repository(runtime,reader,label+'-reader-scope',{blob})
    receipt.update(independentRemoteDigestVerified=True,readerScope=reader_scope,
        writerRepositoryBytes=runtime.cleanup_verified_clone(repository,writer_role,commit,True),
        readerRepositoryBytes=runtime.cleanup_verified_clone(reader,reader_role,commit,True),
        bothDisposableRepositoriesRemoved=True,newDOMExecuted=False,performanceAccepted=None,gateReevaluated=False)
    write_receipt(runtime.OUTPUT/(label+'-receipt.json'),receipt)
    return receipt
