"""Publish authenticated current CI bytes in bounded slices with independent remote readback."""
import hashlib
import json
import os
from pathlib import Path
import signal
import sys
import tarfile

if sys.flags.optimize or os.name != 'posix':
    raise RuntimeError('Bounded CI publication requires non-optimized Python on Linux')

REPOSITORY = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
COLLECTION = Path('/run/rustdom-ci-4196-artifacts-20261026')
WORK = Path('/run/rustdom-ci-4196-publication-20261026')
OUTPUT = REPOSITORY/'.cache/ci-4196-bounded-publication'
INITIAL_PARENT = '648344ed0bb3b6a8e01af398a3a70d7aceab5591'
NAMESPACE = 'reports/validation/jsdom-block-pilot-v2/ci-4196c496/artifacts'
HELPER_PATH = REPOSITORY/'.cache/qualify-bounded-git-transport.py'
HELPER_SHA256 = '862e03c906aea630e252042e72bac4688d1c35ded06f91c465651fcea6b7b243'
COLLECTOR_PATH = REPOSITORY/'.cache/collect-ci-4196-bounded.py'
COLLECTOR_SHA256 = 'a9336a6ecacf17bd81be4464bd97d7d12810edae3078d811197a58b5141d99e7'
SLICE_BYTES = 16777216
MAX_INPUT_BYTES = 268435456
MAX_METADATA_BYTES = 16777216
OUTPUT_ACQUIRED = False

raw = COLLECTOR_PATH.read_bytes()
if hashlib.sha256(raw).hexdigest() != COLLECTOR_SHA256:
    raise ValueError('Current reviewed collector dependency closure changed')
current = {'__name__':'current_ci_publication_readers','__file__':str(COLLECTOR_PATH)}
exec(compile(raw,str(COLLECTOR_PATH),'exec'),current)
helpers = current['transport']
helpers['WORK'] = WORK
helpers['OUTPUT'] = OUTPUT
helpers['POLICY'] = dict(helpers['POLICY'], namespace=NAMESPACE, expectedInitialParent=INITIAL_PARENT)
git = helpers['GIT']
command = helpers['command']


def publish_file(filename, relative_prefix, parent, author, ordinal):
    """Authenticate every remote slice and the whole original before rotating repositories."""
    expected_bytes = filename.stat().st_size
    expected_digest = helpers['checksum_file'](filename)
    if filename.is_symlink() or not filename.is_file() or not 0 < expected_bytes <= MAX_INPUT_BYTES:
        raise ValueError('Publication input is missing, linked or exceeds its byte bound')
    combined = hashlib.sha256()
    parts = []
    with filename.open('rb') as reader:
        for offset in range(0, expected_bytes, SLICE_BYTES):
            label = str(ordinal).zfill(4)
            ordinal += 1
            part_index = len(parts)
            publisher_role = 'publish-'+label
            reader_role = 'read-'+label
            publisher = helpers['clone_bare'](publisher_role,parent)
            payload = reader.read(min(SLICE_BYTES,expected_bytes-offset))
            if len(payload) != min(SLICE_BYTES,expected_bytes-offset):
                raise ValueError('Original publication input became partial')
            checksum = hashlib.sha256(payload).hexdigest()
            relative = relative_prefix+'/'+str(part_index).zfill(4)+'.bin'
            blob = helpers['object_id'](command(git+['hash-object','-w','--stdin'],label+'-blob',publisher,payload))
            del payload
            tree = helpers['add_metadata_tree'](publisher,parent,relative,blob,label)
            commit = helpers['object_id'](command(git+['-c','user.name='+author[0],'-c','user.email='+author[1],
                'commit-tree',tree,'-p',parent],label+'-commit',publisher,
                ('chore: conservar artifact CI autenticado '+label+'\n').encode()))
            intent = {'parent':parent,'commit':commit,'tree':tree,'path':relative,'bytes':min(SLICE_BYTES,expected_bytes-offset),
                'sha256':checksum,'blob':blob,'automaticMutationRetries':0,'forcePush':False}
            (OUTPUT/(label+'-intent.json')).write_bytes(json.dumps(intent,indent=2).encode()+b'\n')
            if helpers['remote_head'](label+'-before-push') != parent:
                raise ValueError('Concurrent evidence publication detected; retain local commit')
            credential = '!"/mnt/c/Program Files/GitHub CLI/gh.exe" auth git-credential'
            command(git+['-c','credential.helper=','-c','credential.helper='+credential,'-c','pack.window=0',
                'push','--porcelain','origin',commit+':'+helpers['REF']],label+'-push',publisher)
            if helpers['remote_head'](label+'-after-push') != commit:
                raise ValueError('Remote publication remains unconfirmed; retain clones and intent')
            independent_reader = helpers['clone_bare'](reader_role,commit)
            observed = helpers['read_back'](independent_reader,commit,relative,label+'-read-back',intent['bytes'],combined)
            if observed != checksum:
                raise ValueError('Independent remote slice digest differs; retain clones')
            publisher_size = helpers['cleanup_verified_clone'](publisher,publisher_role,commit,True)
            reader_size = helpers['cleanup_verified_clone'](independent_reader,reader_role,commit,True)
            record = dict(intent,independentRemoteDigestVerified=True,publisherRepositoryBytes=publisher_size,
                readerRepositoryBytes=reader_size,bothDisposableRepositoriesRemoved=True)
            (OUTPUT/(label+'-receipt.json')).write_bytes(json.dumps(record,indent=2).encode()+b'\n')
            parts.append(record)
            parent = commit
            print(json.dumps({'publishedPart':label,'commit':commit,'path':relative,'bytes':record['bytes']}),flush=True)
        if reader.read(1):
            raise ValueError('Original publication input grew during transport')
    if combined.hexdigest() != expected_digest or helpers['checksum_file'](filename) != expected_digest:
        raise ValueError('Whole original digest differs from independent remote readback')
    return {'bytes':expected_bytes,'sha256':expected_digest,'parts':parts,'wholeRemoteDigestVerified':True},parent,ordinal


def main():
    global OUTPUT_ACQUIRED
    if OUTPUT.exists() or OUTPUT.is_symlink() or WORK.exists() or WORK.is_symlink():
        raise FileExistsError('Publication requires exclusive new roots; existing evidence is unchanged')
    receipt_raw = (COLLECTION/'receipt.json').read_bytes()
    receipt = json.loads(receipt_raw)
    if receipt['sourceCommit'] != '4196c496187c88c92304516287a7e644659a8536' or not receipt['allFourteenArtifactsAuthenticated']:
        raise ValueError('Only the complete authenticated current CI collection may be published')
    if len(receipt['artifacts']) != 14 or len({record['id'] for record in receipt['artifacts']}) != 14:
        raise ValueError('Publication inventory is incomplete or duplicated')
    # Preflight every byte before any remote mutation.
    for artifact in receipt['artifacts']:
        original = COLLECTION/artifact['originalPath']
        if original.is_symlink() or not original.resolve().is_relative_to(COLLECTION.resolve()):
            raise ValueError('Original artifact escaped the collection')
        if original.stat().st_size != artifact['bytes'] or helpers['checksum_file'](original) != artifact['sha256']:
            raise ValueError('Authenticated original artifact changed before publication')
    if receipt['archiveBytes'] != sum(artifact['bytes'] for artifact in receipt['artifacts']) or receipt['archiveBytes'] > MAX_INPUT_BYTES:
        raise ValueError('Total collection archive bytes differ or exceed the fixed bound')
    WORK.mkdir()
    OUTPUT.mkdir()
    OUTPUT_ACQUIRED = True
    previous_handlers = helpers['start_supervision']()
    try:
        parent = helpers['remote_head']('initial-ref')
        if parent != INITIAL_PARENT:
            raise ValueError('Evidence branch advanced before this publication')
        identity = command(git+['show','-s','--format=%an%x00%ae',receipt['sourceCommit']],'writer-identity').decode().strip().split('\0')
        if len(identity) != 2 or not all(identity):
            raise ValueError('Actual Git author identity is absent or ambiguous')
        original_paths = {record['originalPath'] for record in receipt['artifacts']}
        metadata_members = []
        metadata_tar = WORK/'collection-metadata.tar.gz'
        with tarfile.open(metadata_tar,'x:gz') as archive:
            for filename in sorted(COLLECTION.rglob('*')):
                if not filename.is_file():
                    continue
                relative = filename.relative_to(COLLECTION).as_posix()
                if relative in original_paths:
                    continue
                if filename.is_symlink():
                    raise ValueError('Collection metadata contains a symbolic link')
                metadata_members.append({'path':relative,'bytes':filename.stat().st_size,'sha256':helpers['checksum_file'](filename)})
                archive.add(filename,arcname=relative,recursive=False)
        if metadata_tar.stat().st_size > MAX_METADATA_BYTES:
            raise ValueError('Metadata archive exceeds its publication bound')
        records = []
        ordinal = 0
        for artifact in receipt['artifacts']:
            prefix = NAMESPACE+'/'+artifact['role']+'/'+str(artifact['id'])+'/zip.parts'
            record,parent,ordinal = publish_file(COLLECTION/artifact['originalPath'],prefix,parent,identity,ordinal)
            records.append(dict(record,artifactId=artifact['id'],artifactName=artifact['name'],runId=artifact['runId']))
        metadata_record,parent,ordinal = publish_file(metadata_tar,NAMESPACE+'/collection-metadata.tar.gz.parts',parent,identity,ordinal)
        summary = {'sourceCommit':receipt['sourceCommit'],'collectionReceiptSha256':hashlib.sha256(receipt_raw).hexdigest(),
            'artifacts':records,'originalArchiveBytes':receipt['archiveBytes'],'allFourteenOriginalArchivesRoundTripped':True,
            'metadataArchive':metadata_record,'metadataMembers':metadata_members,'finalEvidenceCommit':parent,
            'transportScriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'helpersSha256':HELPER_SHA256,
            'independentRemoteReadbackForEveryPart':True,'unconfirmedPublicationAutomaticallyRetried':False,
            'DOMExecuted':False,'archivedCodeExecuted':False,'scientificCaptureExecuted':False,
            'offlineReplayPerformedHere':False,'scientificCapturePreservationQualified':False,
            'performanceAccepted':None,'gateReevaluated':False}
        (OUTPUT/'summary.json').write_bytes(json.dumps(summary,indent=2).encode()+b'\n')
        print(json.dumps({key:value for key,value in summary.items() if key not in ['artifacts','metadataMembers','metadataArchive']}),flush=True)
    except BaseException as error:
        subtree = helpers['settle_tree'](terminate=True)
        with (OUTPUT/'failure.json').open('xb') as writer:
            writer.write(json.dumps({'type':type(error).__name__,'message':str(error),'subtree':subtree,
                'remoteOutcome':'inspect intents/ref without mutation retry','originalsRetained':True},indent=2).encode()+b'\n')
        raise
    finally:
        for requested,handler in previous_handlers.items():
            signal.signal(requested,handler)


if __name__ == '__main__':
    if len(sys.argv) != 1:
        raise ValueError('Bounded CI publisher accepts no arguments')
    main()
