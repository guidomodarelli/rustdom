"""Materialize authenticated current artifacts externally and replay data using current reviewed code only."""
import hashlib
import json
import os
from pathlib import Path
import signal
import sys

if sys.flags.optimize or os.name != 'posix':
    raise RuntimeError('CI offline replay requires non-optimized Python on Linux')

REPOSITORY = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
SOURCE = Path('/dev/shm/rustdom-pilot-v2-published-525e2be6')
COLLECTION = Path('/run/rustdom-ci-4196-artifacts-20261026')
ROOT = Path('/run/rustdom-ci-4196-replay-20261026')
SOURCE_COMMIT = '4196c496187c88c92304516287a7e644659a8536'
PRIMARY = Path('/mnt/c/Users/guido/ghq/projects/rustdom')
PILOT = SOURCE/'reports/benchmarks/native-class-ownership/control-precision/pilot-v2'
COLLECTOR = REPOSITORY/'.cache/collect-ci-4196-bounded.py'
COLLECTOR_SHA256 = 'a9336a6ecacf17bd81be4464bd97d7d12810edae3078d811197a58b5141d99e7'
raw = COLLECTOR.read_bytes()
if hashlib.sha256(raw).hexdigest() != COLLECTOR_SHA256:
    raise ValueError('Current reviewed collector changed')
current = {'__name__':'current_ci_offline_readers','__file__':str(COLLECTOR)}
exec(compile(raw,str(COLLECTOR),'exec'),current)
transport = current['transport']
transport['OUTPUT'] = ROOT/'journals'
command = transport['command']


def replay():
    if ROOT.exists() or ROOT.is_symlink():
        raise FileExistsError('Offline replay requires an exclusive new root')
    receipt_raw = (COLLECTION/'receipt.json').read_bytes()
    receipt = json.loads(receipt_raw)
    if receipt['sourceCommit'] != SOURCE_COMMIT or not receipt['allFourteenArtifactsAuthenticated']:
        raise ValueError('Offline replay input is incomplete or refers to another source')
    if SOURCE.is_symlink() or not (SOURCE/'.git').is_dir():
        raise ValueError('Offline replay requires a real Linux Git checkout')
    ROOT.mkdir()
    transport['OUTPUT'].mkdir()
    previous_handlers = transport['start_supervision']()
    try:
        if command(transport['GIT']+['rev-parse','HEAD'],'source-head',SOURCE).decode().strip() != SOURCE_COMMIT:
            raise ValueError('Native replay source commit differs')
        if command(transport['GIT']+['status','--porcelain'],'source-clean',SOURCE) != b'':
            raise ValueError('Native replay source is not clean')
        sdks = {}
        for version,relative,checksum in [
            ('22.12.0','.tools/node-22/bin/node','177208bfc4a9403121a40c72d038c670f4fd937fa16ca7df0a720e90be0fe2d9'),
            ('24.14.1','.tools/node/bin/node','bf9112eb83a827dc9f9c8d19bb7bddcbf00f7b2fedae18fdcaee05406981f20a')]:
            node = PRIMARY/relative
            if transport['checksum_file'](node) != checksum or command([str(node),'--version'],'sdk-'+version,SOURCE).strip() != ('v'+version).encode():
                raise ValueError('Pinned Node version or binary digest differs')
            sdks[version] = str(node)
        source_files = json.loads(command([sdks['22.12.0'],'-e',
            'process.stdout.write(JSON.stringify(require("./reports/benchmarks/native-class-ownership/control-precision/pilot-v2/capture/source.cjs").currentFiles()));'],
            'current-source-files',SOURCE))
        materialized = []
        records = []
        for artifact in receipt['artifacts']:
            destination = ROOT/('artifact-'+str(artifact['id']))
            if destination.resolve().is_relative_to(SOURCE.resolve()) or destination.resolve().is_relative_to(REPOSITORY.resolve()):
                raise ValueError('Artifact materialization must remain outside the source repositories')
            result = current['materializer']['materialize'](COLLECTION/artifact['originalPath'],artifact,destination)
            materialized.append(result)
            (ROOT/('materialized-'+str(artifact['id'])+'.json')).write_bytes(json.dumps(result,indent=2).encode()+b'\n')
            if artifact['role'] != 'contracts' or not artifact['name'].startswith('jsdom-block-calendar-'):
                continue
            data_sdk = artifact['name'].split('-calendar-')[1].split('-'+SOURCE_COMMIT)[0]
            if data_sdk not in sdks:
                raise ValueError('Calendar data SDK is outside the pinned set')
            for phase in ['AA','AB']:
                label = data_sdk+'-'+phase
                expected_file = destination/(phase+'-expected.json')
                expected = json.loads(expected_file.read_bytes())
                if expected['sourceCommit'] != SOURCE_COMMIT or expected['files'] != source_files:
                    raise ValueError('Original expected source commit or file pins differ from the actual checkout')
                if expected['mode'] != 'functional' or not expected['requireComplete'] or not expected['requireSupervisor']:
                    raise ValueError('Replay input is not the complete functional CI contract')
                if expected['criterionId'] != 'v'+data_sdk+'/'+phase+'/jsdom/mutation-records-collect/100':
                    raise ValueError('Functional replay criterion identity differs')
                archive = json.loads((destination/(phase+'-archive.json')).read_bytes())
                target = ROOT/('capture-'+label)
                command([sys.executable,'-B',str(PILOT/'capture/archive.py'),'--extract',str(destination/(phase+'.tar.gz')),
                    archive['archiveSha256'],str(target)],label+'-extract',SOURCE,timeout_seconds=180)
                for reader_sdk,node in sdks.items():
                    output = ROOT/(label+'-reader-'+reader_sdk+'.json')
                    command([node,str(PILOT/'capture/verify.cjs'),str(target),str(expected_file),str(output)],
                        label+'-reader-'+reader_sdk,SOURCE,timeout_seconds=120)
                    result = json.loads(output.read_bytes())
                    if not result['complete'] or result['totals']['processes'] != 32 or result['analysis'] is not None:
                        raise ValueError('Functional CI replay is incomplete or unexpectedly performs analysis')
                    record = {'dataSdk':data_sdk,'phase':phase,'readerSdk':reader_sdk,'result':output.name,'totals':result['totals']}
                    records.append(record)
                    print(json.dumps(record),flush=True)
        if len(materialized) != 14 or len(records) != 8:
            raise ValueError('Artifact materialization or both-SDK replay matrix is incomplete')
        if command(transport['GIT']+['status','--porcelain'],'source-clean-after',SOURCE) != b'':
            raise ValueError('Offline replay modified the reviewed source checkout')
        summary = {'sourceCommit':SOURCE_COMMIT,'collectionReceiptSha256':hashlib.sha256(receipt_raw).hexdigest(),
            'allFourteenArtifactsMaterialized':True,'materializedArtifacts':materialized,'replays':records,
            'sourceMetadataNormalized':False,'sourceCheckoutCleanAfter':True,'archivedCodeExecuted':False,
            'newDOMExecuted':False,'scientificCaptureExecuted':False,'performanceAccepted':None,'gateReevaluated':False}
        (ROOT/'summary.json').write_bytes(json.dumps(summary,indent=2).encode()+b'\n')
        print(json.dumps({'materializedArtifacts':len(materialized),'replaysPassed':len(records),'sourceCheckoutCleanAfter':True}),flush=True)
    except BaseException as error:
        subtree = transport['settle_tree'](terminate=True)
        with (ROOT/'failure.json').open('xb') as writer:
            writer.write(json.dumps({'type':type(error).__name__,'message':str(error),'subtree':subtree,
                'partialsPreserved':True,'newMeasurementExecuted':False},indent=2).encode()+b'\n')
        raise
    finally:
        for requested,handler in previous_handlers.items():
            signal.signal(requested,handler)


if __name__ == '__main__':
    if len(sys.argv) != 1:
        raise ValueError('Offline CI replay accepts no arguments')
    replay()
