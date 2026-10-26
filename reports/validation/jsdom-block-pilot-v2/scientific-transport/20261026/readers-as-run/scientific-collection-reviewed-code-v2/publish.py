"""Publish original evidence in bounded Git parts, with independent remote reads and no mutation retry."""
import hashlib
import json
from pathlib import Path
import re

import artifacts
import runtime


def publish_file(filename, relative_prefix, parent, author, ordinal):
    """Rotate only confirmed disposable writers/readers; retain all unconfirmed commits and intents."""
    filename = Path(filename)
    if (filename.is_symlink() or not filename.is_file() or type(ordinal) is not int or ordinal < 0
            or not re.fullmatch(runtime.POLICY['gitObjectPattern'],parent)
            or len(author) != 2 or not all(isinstance(value,str) and value and '\n' not in value and '\x00' not in value for value in author)):
        raise ValueError('Evidence publication input/parent/author is invalid')
    # Check the resulting path before any remote read or Git clone.
    relative_sample = relative_prefix+'/0000.bin'
    if (not re.fullmatch(runtime.POLICY['reportPathPattern'],relative_sample)
            or len(relative_sample.encode()) > runtime.POLICY['maximumReportPathBytes']
            or any(part in ['', '.', '..'] or part.endswith('.') for part in relative_sample.split('/'))):
        raise ValueError('Evidence publication prefix is not canonical and portable')
    expected_bytes = filename.stat().st_size
    if not 0 < expected_bytes <= runtime.POLICY['maximumArchiveBytes']:
        raise ValueError('Evidence publication input exceeds the receiver bound')
    expected_digest = runtime.checksum_path(filename)
    combined = hashlib.sha256()
    parts = []
    with filename.open('rb') as reader:
        for offset in range(0,expected_bytes,artifacts.POLICY['partBytes']):
            label = str(ordinal).zfill(5)
            ordinal += 1
            publisher_role = 'publish-'+label
            reader_role = 'read-'+label
            publisher = runtime.clone_bare(publisher_role,parent)
            payload = reader.read(min(artifacts.POLICY['partBytes'],expected_bytes-offset))
            size = min(artifacts.POLICY['partBytes'],expected_bytes-offset)
            if len(payload) != size:
                raise ValueError('Evidence publication input became partial')
            checksum = hashlib.sha256(payload).hexdigest()
            relative = relative_prefix+'/'+str(len(parts)).zfill(4)+'.bin'
            blob = runtime.object_id(runtime.command(runtime.GIT+['hash-object','-w','--stdin'],label+'-blob',publisher,payload))
            del payload
            tree = runtime.add_metadata_tree(publisher,parent,relative,blob,label)
            commit = runtime.object_id(runtime.command(runtime.GIT+['-c','user.name='+author[0],'-c','user.email='+author[1],
                'commit-tree',tree,'-p',parent],label+'-commit',publisher,('chore: conservar evidencia autenticada '+label+'\n').encode()))
            intent = {'parent':parent,'commit':commit,'tree':tree,'path':relative,'bytes':size,
                'sha256':checksum,'blob':blob,'automaticMutationRetries':0,'forcePush':False}
            (runtime.OUTPUT/(label+'-intent.json')).write_bytes(json.dumps(intent,indent=2).encode()+b'\n')
            if runtime.remote_head(label+'-before-push') != parent:
                raise ValueError('Concurrent evidence branch update; retain unpushed local commit')
            runtime.command(runtime.GIT+['-c','pack.window=0','push','--porcelain','origin',commit+':'+runtime.REF],label+'-push',publisher)
            if runtime.remote_head(label+'-after-push') != commit:
                raise ValueError('Evidence publication is unconfirmed; retain clones and intent')
            independent_reader = runtime.clone_bare(reader_role,commit)
            observed = runtime.read_back(independent_reader,commit,relative,label+'-read-back',size,combined)
            if observed != checksum:
                raise ValueError('Independent remote evidence digest differs; retain clones')
            publisher_size = runtime.cleanup_verified_clone(publisher,publisher_role,commit,True)
            reader_size = runtime.cleanup_verified_clone(independent_reader,reader_role,commit,True)
            record = dict(intent,independentRemoteDigestVerified=True,publisherRepositoryBytes=publisher_size,
                readerRepositoryBytes=reader_size,bothDisposableRepositoriesRemoved=True)
            (runtime.OUTPUT/(label+'-receipt.json')).write_bytes(json.dumps(record,indent=2).encode()+b'\n')
            parts.append(record)
            parent = commit
        if reader.read(1):
            raise ValueError('Evidence publication input grew during transport')
    if combined.hexdigest() != expected_digest or runtime.checksum_path(filename) != expected_digest:
        raise ValueError('Whole original evidence differs from independently read remote parts')
    return {'bytes':expected_bytes,'sha256':expected_digest,'parts':parts,
        'wholeRemoteDigestVerified':True,'automaticMutationRetries':0},parent,ordinal
