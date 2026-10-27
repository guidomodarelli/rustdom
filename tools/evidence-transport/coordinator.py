"""Receive, preserve, replay and retire exactly one owned artifact slot at a time."""
import json
from pathlib import Path
import shutil
import stat

import artifacts
import publish
import replay
import runtime
import storage

POLICY = json.loads((Path(__file__).resolve().parent/'constants/coordinator.json').read_bytes())


def copy_bounded(source, destination, expected_bytes):
    """Retain at most the declared byte count even if a verified input grows before/during copying."""
    if type(expected_bytes) is not int or not 0 < expected_bytes <= runtime.POLICY['maximumArchiveBytes']:
        raise ValueError('Borrowed copy requires a positive bounded byte count')
    received = 0
    stored = 0
    with source.open('rb') as reader,destination.open('xb') as writer:
        while True:
            runtime.check_cancelled()
            chunk = reader.read(min(runtime.POLICY['readChunkBytes'],expected_bytes-stored+1))
            if not chunk:
                break
            received += len(chunk)
            writable = min(len(chunk),expected_bytes-stored)
            if writable:
                written = writer.write(chunk[:writable])
                if written != writable:
                    raise OSError('Borrowed original copy short write')
                stored += written
            if received > expected_bytes:
                raise ValueError('Borrowed original grew beyond its authenticated byte count; bounded partial retained')
    if stored != expected_bytes:
        raise ValueError('Borrowed original became incomplete; partial retained')


def receive_or_borrow(record, borrowed_original=None):
    """Borrow only immutable bytes; copy them into a new receiver-owned slot before any retirement."""
    metadata = record['metadata']
    storage.require_capacity(runtime.OUTPUT,metadata['size_in_bytes'])
    if borrowed_original is None:
        return artifacts.receive_original(record)
    identity = str(metadata['id'])
    if json.loads(artifacts.api('actions/artifacts/'+identity,'metadata-'+identity)) != metadata:
        raise ValueError('Borrowed original metadata differs from its current API identity')
    borrowed_original = Path(borrowed_original)
    if borrowed_original.is_symlink() or not borrowed_original.is_file() or borrowed_original.stat().st_size != metadata['size_in_bytes']:
        raise ValueError('Borrowed original must be a physical file with the authenticated byte count')
    if runtime.checksum_path(borrowed_original) != metadata['digest'][7:]:
        raise ValueError('Borrowed original differs from the current API digest')
    directory = runtime.OUTPUT/('zip-'+identity)
    directory.mkdir(exist_ok=False)
    destination = directory/'stdout.bin'
    copy_bounded(borrowed_original,destination,metadata['size_in_bytes'])
    checksum = runtime.checksum_path(destination)
    if checksum != metadata['digest'][7:] or destination.stat().st_size != metadata['size_in_bytes']:
        raise ValueError('Borrowed original changed during its exclusive receiver-owned copy')
    return {'id':metadata['id'],'name':metadata['name'],'bytes':metadata['size_in_bytes'],'sha256':checksum,
        'ordinal':record['ordinal'],'jobId':record['jobId'],'jobConclusion':record['jobConclusion'],
        'originalPath':destination.relative_to(runtime.OUTPUT).as_posix(),
        'borrowedSourceNotRemoved':True,'measurementExecuted':False,'archivedCodeExecuted':False}


def retire_slot(slot, original, publication, final_commit, inspection, label):
    """Delete only owned copies after whole remote readback and both SDKs finish, including rejections."""
    runtime.check_cancelled()
    marker = {'artifactId':original['id'],'sha256':original['sha256'],'namespace':runtime.POLICY['namespace'],
        'outputRoot':str(runtime.OUTPUT)}
    if (slot.is_symlink() or slot.resolve().parent != runtime.WORK
            or slot.name != POLICY['slotPrefix']+str(original['id'])
            or json.loads((slot/POLICY['ownershipFile']).read_bytes()) != marker):
        raise ValueError('Artifact retirement target is outside the owned slot')
    readers = inspection.get('readers')
    if not isinstance(readers,list):
        raise ValueError('Artifact retirement requires completed reader receipts')
    if original['ordinal'] is None:
        if inspection.get('kind') != 'preflight' or readers:
            raise ValueError('Preflight retirement requires its authenticated consumption result')
    elif {reader['node'] for reader in readers} != set(POLICY['sdkPaths']):
        raise ValueError('Artifact retirement requires both pinned Node readers')
    for reader in readers:
        result_path = runtime.OUTPUT/reader['resultPath']
        if result_path.is_symlink() or not result_path.resolve().is_relative_to(runtime.OUTPUT) or runtime.checksum_path(result_path) != reader['resultSha256']:
            raise ValueError('Completed reader result changed before retirement')
    if (publication.get('wholeRemoteDigestVerified') is not True or publication['bytes'] != original['bytes']
            or publication['sha256'] != original['sha256'] or not publication['parts']
            or publication['parts'][-1]['commit'] != final_commit
            or not all(part['independentRemoteDigestVerified'] and part['bothDisposableRepositoriesRemoved'] for part in publication['parts'])):
        raise ValueError('Artifact retirement requires intact independently confirmed remote publication')
    if runtime.remote_head(label+'-retire-ref') != final_commit or runtime.owned_processes():
        raise ValueError('Artifact retirement requires the confirmed branch and an empty owned process subtree')
    filename = runtime.OUTPUT/original['originalPath']
    expected_filename = runtime.OUTPUT/('zip-'+str(original['id']))/'stdout.bin'
    if filename != expected_filename or filename.is_symlink() or filename.resolve() != expected_filename or filename.stat().st_nlink != 1:
        raise ValueError('Only the exclusive receiver-owned original copy may be retired')
    if filename.stat().st_size != original['bytes'] or runtime.checksum_path(filename) != original['sha256']:
        raise ValueError('Original changed after remote readback; retain local evidence')
    inventory = []
    for member in sorted(slot.rglob('*')):
        status = member.lstat()
        if member.is_symlink() or not (stat.S_ISDIR(status.st_mode) or stat.S_ISREG(status.st_mode)):
            raise ValueError('Owned retirement slot contains linked or special entries')
        if stat.S_ISREG(status.st_mode):
            if status.st_nlink != 1:
                raise ValueError('Owned retirement slot contains a hard link')
            inventory.append({'path':member.relative_to(slot).as_posix(),'bytes':status.st_size,'sha256':runtime.checksum_path(member)})
    replay.write_json(runtime.OUTPUT/(label+'-retirement-intent.json'),{'original':original,'publication':publication,
        'finalCommit':final_commit,'inspection':inspection,'derivedFiles':inventory,'ownedCopiesOnly':True})
    shutil.rmtree(slot)
    filename.unlink()
    if slot.exists() or filename.exists():
        raise OSError('Confirmed artifact copy retirement did not complete')
    result = {'originalCopyBytesRetired':original['bytes'],'derivedCopiesBytesRetired':sum(entry['bytes'] for entry in inventory),
        'derivedFilesRetired':len(inventory),'originalStillPreservedInGit':True,'bothPinnedReadersFinished':original['ordinal'] is not None,
        'remoteReadbackRequired':True,'borrowedInputNotRemoved':original.get('borrowedSourceNotRemoved',False)}
    replay.write_json(runtime.OUTPUT/(label+'-retired.json'),result)
    return result


def coordinate_one(record, *, relative_prefix, parent, author, ordinal, inspect, borrowed_original=None, before_publication=None):
    """Never delete on uncertain publication or failed inspection; retain raw files and every intent."""
    original = receive_or_borrow(record,borrowed_original)
    label = 'artifact-'+str(original['id'])
    replay.write_json(runtime.OUTPUT/(label+'-received.json'),original)
    if before_publication is not None:
        before_publication(original)
    publication,final_commit,next_ordinal = publish.publish_file(runtime.OUTPUT/original['originalPath'],
        relative_prefix,parent,author,ordinal)
    replay.write_json(runtime.OUTPUT/(label+'-publication.json'),publication)
    slot = runtime.WORK/(POLICY['slotPrefix']+str(original['id']))
    slot.mkdir(exist_ok=False)
    replay.write_json(slot/POLICY['ownershipFile'],{'artifactId':original['id'],'sha256':original['sha256'],
        'namespace':runtime.POLICY['namespace'],'outputRoot':str(runtime.OUTPUT)})
    try:
        members = artifacts.inventory_zip(runtime.OUTPUT/original['originalPath'])
        storage.require_capacity(slot,sum(member['bytes'] for member in members))
        extracted = slot/'extracted'
        if artifacts.inventory_zip(runtime.OUTPUT/original['originalPath'],extracted) != members:
            raise ValueError('Published original ZIP changed during extraction')
        inspection = inspect(extracted,original)
        replay.write_json(runtime.OUTPUT/(label+'-'+POLICY['inspectionFile']),inspection)
        retirement = retire_slot(slot,original,publication,final_commit,inspection,label)
        result = {'original':original,'members':members,'publication':publication,'inspection':inspection,
            'retirement':retirement,'newDOMExecuted':False,'performanceAccepted':None,'gateReevaluated':False}
        replay.write_json(runtime.OUTPUT/(label+'-completed.json'),result)
        return result,final_commit,next_ordinal
    except BaseException as error:
        replay.write_json(runtime.OUTPUT/(label+'-failure.json'),{'errorType':type(error).__name__,
            'message':str(error)[:POLICY['maximumFailureCharacters']],'original':original,
            'wholeOriginalAlreadyPublished':True,'finalCommit':final_commit,'localCopiesRetainedUnlessRetirementAlreadyConfirmed':True,
            'newDOMExecuted':False,'performanceAccepted':None,'gateReevaluated':False})
        raise
