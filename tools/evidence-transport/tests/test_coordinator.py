"""Exercise destructive-boundary refusal with actual owned files and filesystem state, without SDK mocks."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import signal
import sys

if sys.flags.optimize or sys.platform != 'linux':
    raise RuntimeError('Coordinator boundary tests require non-optimized Linux Python')


def suite(arguments):
    tool = Path(__file__).resolve().parent.parent
    raw = arguments.descriptor.read_bytes()
    if hashlib.sha256(raw).hexdigest() != arguments.descriptor_sha:
        raise ValueError('Independently fixed coordinator descriptor differs')
    descriptor = json.loads(raw)
    loader_path = tool/'loader.py'
    loader_raw = loader_path.read_bytes()
    if len(loader_raw) != descriptor['loader']['bytes'] or hashlib.sha256(loader_raw).hexdigest() != descriptor['loader']['sha256']:
        raise ValueError('Pinned coordinator loader differs')
    current = {'__name__':'pinned_coordinator_boundary_loader','__file__':str(loader_path)}
    exec(compile(loader_raw,str(loader_path),'exec'),current)
    modules = current['load'](tool,descriptor['files'])
    runtime = modules['runtime']
    coordinator = modules['coordinator']
    replay = modules['replay']
    storage = modules['storage']
    root = arguments.root
    root.mkdir(exist_ok=False)
    runtime.configure(source=arguments.source,output=root/'journals',work=root/'work',
        branch='feature/pilot-v2-ci-evidence',namespace='reports/validation/coordinator-boundaries',native_cli=arguments.cli)
    handlers = runtime.start_supervision()
    records = []
    try:
        try:
            storage.require_capacity(runtime.WORK,shutil.disk_usage(runtime.WORK).free+1)
        except OSError:
            pass
        else:
            raise AssertionError('Impossible current filesystem allocation was admitted')
        records.append({'case':'insufficient-real-capacity-refused','passed':True})
        copy_source = root/'growing-input.bin'
        snapshot = b'original-snapshot'
        copy_source.write_bytes(snapshot)
        initial_checksum = runtime.checksum_path(copy_source)
        copy_source.write_bytes(snapshot+b'growth-after-snapshot')
        bounded = root/'bounded-partial.bin'
        try:
            coordinator.copy_bounded(copy_source,bounded,len(snapshot))
        except ValueError:
            pass
        else:
            raise AssertionError('A real input grown after its snapshot exceeded the byte bound')
        if bounded.read_bytes() != snapshot or bounded.stat().st_size != len(snapshot):
            raise AssertionError('Growing file copy exceeded its declared on-disk byte limit')
        records.append({'case':'input-grown-after-real-snapshot-rejected-with-exact-bound',
            'initialSnapshotSha256':initial_checksum,'partialBytes':len(snapshot),'passed':True})
        identity = 1234567
        original_directory = runtime.OUTPUT/('zip-'+str(identity))
        original_directory.mkdir()
        original_file = original_directory/'stdout.bin'
        original_raw = b'unpublished-owned-copy'
        original_file.write_bytes(original_raw)
        original = {'id':identity,'sha256':runtime.checksum_path(original_file),'bytes':len(original_raw),
            'originalPath':original_file.relative_to(runtime.OUTPUT).as_posix(),'ordinal':0}
        slot = runtime.WORK/(coordinator.POLICY['slotPrefix']+str(identity))
        slot.mkdir()
        replay.write_json(slot/coordinator.POLICY['ownershipFile'],{'artifactId':identity,'sha256':original['sha256'],
            'namespace':runtime.POLICY['namespace'],'outputRoot':str(runtime.OUTPUT)})
        sentinel = slot/'sentinel.txt'
        sentinel.write_bytes(b'derived-copy-still-needed')
        foreign = root/'foreign'
        foreign.mkdir()
        (foreign/'sentinel.txt').write_bytes(b'outside-owned-workspace')
        readers = []
        for version in coordinator.POLICY['sdkPaths']:
            filename = runtime.OUTPUT/(version+'-invalid-caller-claim.json')
            replay.write_json(filename,{'purpose':'invalid caller receipt; never an actual Node execution'})
            readers.append({'node':version,'resultPath':filename.relative_to(runtime.OUTPUT).as_posix(),
                'resultSha256':runtime.checksum_path(filename)})
        def reject(label,target,inspection):
            try:
                coordinator.retire_slot(target,original,{'wholeRemoteDigestVerified':False},'0'*40,inspection,label)
            except ValueError:
                pass
            else:
                raise AssertionError('Unverified artifact retirement succeeded: '+label)
            if (original_file.read_bytes() != original_raw or sentinel.read_bytes() != b'derived-copy-still-needed'
                    or (foreign/'sentinel.txt').read_bytes() != b'outside-owned-workspace'):
                raise AssertionError('Rejected retirement changed a real sentinel or original')
            records.append({'case':label,'passed':True})
        reject('outside-owned-slot-refused',foreign,{'readers':readers})
        reject('missing-second-reader-keeps-copies',slot,{'readers':readers[:1]})
        reject('unconfirmed-publication-keeps-copies',slot,{'readers':readers})
        result_file = runtime.OUTPUT/readers[0]['resultPath']
        result_file.write_bytes(result_file.read_bytes()+b'changed')
        reject('changed-reader-result-keeps-copies',slot,{'readers':readers})
        if runtime.owned_processes() or list(runtime.OUTPUT.glob('*.process.json')):
            raise AssertionError('Boundary refusals started external clients')
        summary = {'cases':records,'realFilesystemSentinelsPreserved':True,'GitHubInvoked':False,
            'nativeClientsStarted':False,'newDOMExecuted':False,'scientificCaptureExecuted':False,
            'invalidCallerFixturesAreNotNodeResults':True,'descriptorSha256':arguments.descriptor_sha}
        (root/'summary.json').write_bytes(json.dumps(summary,indent=2).encode()+b'\n')
        print(json.dumps({'passed':len(records)}),flush=True)
    finally:
        runtime.settle_tree(terminate=True)
        for requested,handler in handlers.items():
            signal.signal(requested,handler)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for name in ['source','root','cli','descriptor']:
        parser.add_argument('--'+name,type=Path,required=True)
    parser.add_argument('--descriptor-sha',required=True)
    suite(parser.parse_args())
