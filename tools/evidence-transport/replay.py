"""Replay authenticated data with independently selected, pinned current readers and both fixed Node binaries."""
import json
from pathlib import Path
import sys

import runtime
import storage

POLICY = json.loads((Path(__file__).resolve().parent/'constants/coordinator.json').read_bytes())


def write_json(filename, value):
    """Never replace an existing expectation, result or operational receipt."""
    with filename.open('xb') as writer:
        writer.write(json.dumps(value,indent=2).encode()+b'\n')


def initialize_readers(primary, profile_name):
    """Verify source, full declared reader graph and SDK hashes before running any reader code."""
    if profile_name not in POLICY['profiles']:
        raise ValueError('Replay profile is outside the reviewed source scope')
    profile = dict(POLICY['profiles'][profile_name])
    if runtime.command(runtime.GIT+['rev-parse','HEAD'],'reader-'+profile_name+'-head').strip() != POLICY['readerSourceCommit'].encode():
        raise ValueError('Replay requires the actual qualified Linux source commit')
    if runtime.command(runtime.GIT+['status','--porcelain'],'reader-'+profile_name+'-clean') != b'':
        raise ValueError('Replay requires a clean real Linux Git checkout')
    publication = runtime.SOURCE/profile['publication']
    if runtime.checksum_path(publication) != profile['publicationSha256']:
        raise ValueError('Replay publication differs from the independently pinned receipt')
    files = json.loads(publication.read_bytes())['files']
    if len(files) != profile['publicationBindings']:
        raise ValueError('Replay reader dependency graph cardinality differs')
    for relative,checksum in files.items():
        filename = runtime.SOURCE/relative
        if filename.is_symlink() or runtime.checksum_path(filename) != checksum:
            raise ValueError('Replay reader dependency changed: '+relative)
    sdks = {}
    for version,binding in POLICY['sdkPaths'].items():
        filename = Path(primary)/binding['path']
        if filename.is_symlink() or runtime.checksum_path(filename) != binding['sha256']:
            raise ValueError('Replay Node binary digest differs: '+version)
        if runtime.command([str(filename),'--version'],'reader-'+profile_name+'-'+version).strip() != version.encode():
            raise ValueError('Replay Node binary version differs: '+version)
        sdks[version] = filename
    profile['files'] = files
    profile['sdks'] = sdks
    profile['directory'] = runtime.SOURCE/profile['directory']
    profile['criteria'] = json.loads((profile['directory']/'capture/files.json').read_bytes())['criteria']
    return profile


def run_readers(capture, expected, profile, label):
    """Keep complete, partial and rejected outputs separately; never turn a rejection into acceptance."""
    results = []
    for version,node in profile['sdks'].items():
        operation = label+'-'+version
        result_path = runtime.OUTPUT/(operation+'.result.json')
        try:
            runtime.command([str(node),str(profile['directory']/'capture/verify.cjs'),str(capture),str(expected),
                str(result_path),'--allow-partial'],operation)
        except RuntimeError:
            process = json.loads((runtime.OUTPUT/(operation+'.process.json')).read_bytes())
            if process['exitCode'] not in POLICY['resultExitCodes']:
                raise
        process = json.loads((runtime.OUTPUT/(operation+'.process.json')).read_bytes())
        result = json.loads(result_path.read_bytes())
        if (not isinstance(result,dict) or type(result.get('complete')) is not bool or 'performanceAccepted' not in result
                or result.get('performanceAccepted') is not None or result.get('gateReevaluated') is not False):
            raise ValueError('Replay did not preserve the diagnostic result contract')
        if (process['exitCode'] == 0) is not result['complete']:
            raise ValueError('Replay process exit code contradicts its completeness claim')
        results.append({'node':version,'exitCode':process['exitCode'],
            'resultPath':result_path.relative_to(runtime.OUTPUT).as_posix(),
            'resultSha256':runtime.checksum_path(result_path),'result':result})
    return results


def extract_capture(extracted, archive_name, metadata_name, profile, label):
    """Use the current pinned archive reader on data only; its archived scripts are never imported."""
    archive = extracted/archive_name
    metadata = json.loads((extracted/metadata_name).read_bytes())
    if archive.stat().st_size != metadata['archiveBytes'] or runtime.checksum_path(archive) != metadata['archiveSha256']:
        raise ValueError('Captured tar differs from its independently authenticated ZIP member')
    inventory = json.loads(runtime.command([sys.executable,'-B',str(profile['directory']/'capture/archive.py'),
        '--verify',str(archive),metadata['archiveSha256']],label+'-inventory'))
    if inventory['verified'] is not True or inventory['extracted'] is not False:
        raise ValueError('Current archive reader did not verify the complete bounded tar before extraction')
    storage.require_capacity(extracted,inventory['rawBytes'])
    destination = extracted/('capture-'+label)
    runtime.command([sys.executable,'-B',str(profile['directory']/'capture/archive.py'),
        '--extract',str(archive),metadata['archiveSha256'],str(destination)],label+'-extract')
    return destination


def inspect_capture(extracted, original, context):
    """Derive expectations from a fixed profile and authenticated consumption, including historical failures."""
    profile = context['profile']
    label = 'replay-'+str(original['id'])
    if original['ordinal'] is None:
        consumption = extracted/'capture-consumption.json'
        value = json.loads(consumption.read_bytes())
        if value['allowed'] is not True or value['sourceCommit'] != profile['dataSourceCommit'] or value['currentRunId'] != context['runId']:
            raise ValueError('Consumption receipt does not bind this selected data run/source')
        context['consumptionSha256'] = runtime.checksum_path(consumption)
        return {'kind':'preflight','readers':[],'consumptionSha256':context['consumptionSha256']}
    if 'consumptionSha256' not in context:
        raise ValueError('Criterion replay requires the previously authenticated consumption artifact')
    criterion = profile['criteria'][original['ordinal']]
    expected = {'mode':'capture','criterionId':criterion['criterionId'],'sourceCommit':profile['dataSourceCommit'],
        'files':profile['files'],'requireComplete':True,'requireSupervisor':True,'runId':context['runId'],
        'publicationSha256':profile['publicationSha256'],'consumptionSha256':context['consumptionSha256']}
    expected_path = runtime.OUTPUT/(label+'-expected.json')
    write_json(expected_path,expected)
    if json.loads((extracted/'expected.json').read_bytes()) != expected:
        raise ValueError('Archived expectation differs from the independent data run/source/profile')
    capture = extract_capture(extracted,'criterion.tar.gz','archive.json',profile,label)
    results = run_readers(capture,expected_path,profile,label)
    return {'kind':'criterion','criterionId':criterion['criterionId'],'readers':results,
        'readerAgreement':results[0]['result'] == results[1]['result']}


def inspect_functional_ci(extracted, original, context):
    """Replay both real AA/AB CI fixtures; they are positive controls, never scientific acceptance."""
    profile = context['profile']
    results = []
    cases = []
    for phase in POLICY['functionalPhases']:
        label = 'functional-'+str(original['id'])+'-'+phase
        expected_path = runtime.OUTPUT/(label+'-expected.json')
        criterion_id = context['dataNode']+'/'+phase+'/'+POLICY['functionalOperation']
        runtime.command([str(profile['sdks'][POLICY['expectationSdk']]),str(profile['directory']/'capture/expectation.cjs'),
            'functional',criterion_id,str(expected_path),'--supervised'],label+'-expectation')
        expected = json.loads(expected_path.read_bytes())
        if json.loads((extracted/(phase+'-expected.json')).read_bytes()) != expected:
            raise ValueError('CI archived expectation differs from the actual clean reader source')
        capture = extract_capture(extracted,phase+'.tar.gz',phase+'-archive.json',profile,label)
        readers = run_readers(capture,expected_path,profile,label)
        results.extend(readers)
        cases.append({'phase':phase,'readerAgreement':readers[0]['result'] == readers[1]['result']})
    return {'kind':'functional-ci','readers':results,'cases':cases,
        'readerAgreement':all(case['readerAgreement'] for case in cases)}
