"""Inspect authenticated ZIP data with current readers; never extract or execute archived scripts/addons."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import zipfile
from collect import POLICY, authenticate_artifact, digest

if sys.flags.optimize:
    raise RuntimeError('Range build inspection requires non-optimized Python')


def inspect(repository, collection, job_key, output, node):
    """Require actual artifact pins, preserve every member and replay only current source readers."""
    job = next(entry for entry in POLICY['jobs'] if entry['key'] == job_key)
    assert job.get('artifactPin') is not None, 'Pin this actual completed artifact before offline inspection'
    directory = collection / job_key
    metadata = json.loads((directory / 'artifact.json').read_text(encoding='utf-8'))
    filename = directory / 'artifact.zip'
    authenticate_artifact(metadata, filename, job)
    repository = repository.resolve(strict=True)
    output = output.parent.resolve(strict=True) / output.name
    for original in [repository, collection.resolve(strict=True)]:
        assert output != original and original not in output.parents and output not in original.parents, 'Preserve inputs: inspection output must be disjoint'
    assert not output.exists(), 'Preserve previous inspection outputs'
    source_policy_path = repository / POLICY['sourcePolicyPath']
    assert digest(source_policy_path) == POLICY['sourcePolicySha256']
    source_policy = json.loads(source_policy_path.read_text(encoding='utf-8'))
    output.mkdir()
    result = {'runId': POLICY['runId'], 'head': POLICY['head'], 'attempt': POLICY['attempt'],
        'jobId': job['id'], 'jobKey': job_key, 'artifactId': metadata['id'],
        'zipBytes': filename.stat().st_size, 'zipSha256': digest(filename),
        'functionalOnly': True, 'performanceAccepted': None, 'gateReevaluated': False,
        'collectorExecutedDOM': False, 'completeFunctionalEvidence': False}
    def save():
        (output / 'inspection.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    save()
    try:
        with zipfile.ZipFile(filename) as archive:
            records = []
            names = set()
            for member in archive.infolist():
                assert member.filename not in names, 'Range build ZIP has duplicate member names'
                names.add(member.filename)
                relative = PurePosixPath(member.filename)
                assert not relative.is_absolute() and '..' not in relative.parts and '\\' not in member.filename
                if member.is_dir():
                    records.append({'path': member.filename, 'kind': 'directory', 'bytes': member.file_size})
                    continue
                checksum = hashlib.sha256()
                with archive.open(member) as content:
                    for chunk in iter(lambda: content.read(1024 * 1024), b''):
                        checksum.update(chunk)
                records.append({'path': member.filename, 'kind': 'file', 'bytes': member.file_size, 'sha256': checksum.hexdigest()})
            (output / 'members.json').write_text(json.dumps(records, indent=2) + '\n', encoding='utf-8')
            result.update(regularFiles=sum(record['kind'] == 'file' for record in records),
                uncompressedBytes=sum(record['bytes'] for record in records), allMembersHashed=True)
            indexed = {record['path']: record for record in records}
            missing = [name for name in [*POLICY['names'].values(), *POLICY['distributionEntryPoints']] if name not in names]
            if missing:
                result['missingRequiredMembers'] = missing
                return result
            def read_json(name, maximum=POLICY['maximumMetadataBytes']):
                assert archive.getinfo(name).file_size <= maximum, 'Range build JSON exceeds the declared reader resource bound'
                with archive.open(name) as content:
                    return json.load(content)
            preparation = read_json(POLICY['names']['preparation'])
            assert preparation['complete'] is True and preparation['functionalOnly'] is True
            assert preparation['performanceAccepted'] is None and preparation['benchmarkExecuted'] is False
            assert preparation['revision'] == source_policy['revision']
            assert preparation['before']['sourceCommit'] == preparation['after']['sourceCommit'] == POLICY['head']
            assert preparation['before']['sourceHash'] == source_policy['sourceHashBefore']
            assert preparation['after']['sourceHash'] == source_policy['sourceHashAfter']
            assert preparation['before']['sourceChanges'] == []
            assert preparation['after']['sourceChanges'] == sorted(' M ' + name for name in source_policy['files'] if name.startswith('src/'))
            assert preparation['before']['sourceGitErrors'] == preparation['after']['sourceGitErrors'] == []
            assert preparation['patchSha256'] == source_policy['patchSha256']
            assert preparation['fixtureFiles'] == source_policy['functional']
            assert len(preparation['before']['measuredSources']) == len(preparation['after']['measuredSources']) == POLICY['expected']['sourceIdentityFiles']
            assert preparation['typeDeclarationSha256'] == source_policy['files']['types/native.d.cts']['after']
            assert indexed[POLICY['names']['types']]['sha256'] == preparation['typeDeclarationSha256']
            native = read_json(POLICY['names']['nativeBuild'])
            assert native['node'] == 'v' + job['node'] and native['platform'] == job['platform'] and native['napi'] == 8
            assert native['binarySha256'] == indexed[POLICY['names']['binary']]['sha256']
            assert native['cargoLockSha256'] == digest(repository / 'Cargo.lock')
            assert indexed[POLICY['names']['packageLock']]['sha256'] == digest(repository / 'package-lock.json')
            package = read_json(POLICY['names']['package'])
            assert package['name'] == POLICY['packageName']
            versions = archive.read(POLICY['names']['toolVersions']).decode('utf-8').splitlines()
            assert versions[0] == 'v' + job['node'] and versions[1] == POLICY['npmVersion']
            assert 'release: ' + POLICY['rustVersion'] in versions
            architecture = json.loads(versions[-1])
            assert architecture['platform'] == native['platform'] and architecture['arch'] == native['arch']
            manifest = read_json(POLICY['names']['reportManifest'])
            assert manifest['complete'] is True and manifest['sourceCommit'] == POLICY['head']
            assert manifest['githubRunId'] == str(POLICY['runId']) and manifest['githubRunAttempt'] == str(POLICY['attempt'])
            copied = [entry for entry in manifest['entries'] if entry['kind'] == 'file']
            for entry in copied:
                current = indexed['reports/' + entry['artifactPath']]
                assert current['bytes'] == entry['bytes'] and current['sha256'] == entry['sha256']
            assert manifest['filesCopied'] == len(copied)
            assert manifest['bytesCopied'] == sum(entry['bytes'] for entry in copied)
            wpt_names = [name for name in names if name.startswith('reports/compatibility/') and name.endswith('-wpt.json')]
            html_name = 'reports/validation/html5lib.json'
            if len(wpt_names) != 1 or html_name not in names:
                result['missingCompletedReports'] = {'wptCandidates': wpt_names, 'htmlPresent': html_name in names}
                return result
            inputs = {'memory.json': POLICY['names']['memory'], 'wpt.json': wpt_names[0], 'html.json': html_name}
            for target, source in inputs.items():
                maximum = POLICY['maximumReportJsonBytes'] if target == 'wpt.json' else POLICY['maximumMetadataBytes']
                assert archive.getinfo(source).file_size <= maximum
                with archive.open(source) as content, (output / target).open('xb') as destination:
                    shutil.copyfileobj(content, destination, length=1024 * 1024)
            command = [str(node), '--max-old-space-size=2048', str(Path(__file__).with_name('verify-reports.cjs')),
                str(repository), str(output / 'memory.json'), str(output / 'wpt.json'), str(output / 'html.json')]
            with (output / 'replay.json').open('xb') as stdout, (output / 'replay.stderr.log').open('xb') as stderr:
                replay = subprocess.run(command, cwd=repository, stdout=stdout, stderr=stderr)
            (output / 'replay-command.json').write_text(json.dumps({'argv': command, 'exitCode': replay.returncode,
                'nodeVersion': subprocess.check_output([node, '--version'], text=True).strip(), 'nodeSha256': digest(node),
                'collectorExecutedDOM': False}, indent=2) + '\n', encoding='utf-8')
            assert replay.returncode == 0, 'Range build offline replay failed; preserve this output and inspect stderr without repeating the build'
            verified = json.loads((output / 'replay.json').read_text())
            assert verified['memory']['node'] == verified['wpt']['node'] == verified['html']['node'] == 'v' + job['node']
            result.update(completeFunctionalEvidence=True, nativeBuild=native, preparation=preparation,
                replayVerified=True, reportFiles=inputs, memory=verified['memory'],
                wpt={key: value for key, value in verified['wpt'].items() if key != 'sharedNonpasses'}, html=verified['html'])
        return result
    except Exception as error:
        result['failure'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        save()


if __name__ == '__main__':
    assert len(sys.argv) == 6, 'Provide repository, owned collection, matrix key, fresh output and current Node executable'
    result = inspect(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], Path(sys.argv[4]), Path(sys.argv[5]))
    print(json.dumps({key: result.get(key) for key in ['jobKey', 'artifactId', 'completeFunctionalEvidence', 'replayVerified', 'performanceAccepted', 'regularFiles']}))
