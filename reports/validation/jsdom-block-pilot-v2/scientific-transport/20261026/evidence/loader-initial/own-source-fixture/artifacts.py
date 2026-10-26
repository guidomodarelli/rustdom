"""Authenticate one terminal pilot's metadata and original ZIPs without executing captured code."""
from datetime import datetime
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import stat
import unicodedata
import zipfile

import runtime
import stream

POLICY = json.loads((Path(__file__).resolve().parent/'constants/artifacts.json').read_bytes())


def api(endpoint, label):
    """Preserve the exact current API response through the supervised native client."""
    return runtime.command([str(runtime.NATIVE_CLI),'api','--hostname','github.com','--method','GET',
        'repos/'+POLICY['repository']+'/'+endpoint],label)


def timestamp(value):
    """Require an explicit UTC instant rather than accepting a naive local timestamp."""
    if not isinstance(value,str) or not value.endswith('Z'):
        raise ValueError('Artifact provenance requires an explicit UTC timestamp')
    return datetime.fromisoformat(value[:-1]+'+00:00')


def metadata_plan(run, jobs, artifacts, *, run_id, source_commit, workflow_path, criteria):
    """Bind every available artifact to a known criterion/job; preserve missing outputs as partial."""
    if type(run_id) is not int or run_id <= 0 or not isinstance(source_commit,str) or not re.fullmatch(runtime.POLICY['gitObjectPattern'],source_commit):
        raise ValueError('Pilot run/source identity is invalid')
    if workflow_path not in POLICY['workflowPaths']:
        raise ValueError('Pilot workflow is outside the reviewed transport scope')
    if (not isinstance(criteria,list) or len(criteria) != POLICY['criteriaCount']
            or [criterion['ordinal'] for criterion in criteria] != list(range(POLICY['criteriaCount']))
            or len({criterion['criterionId'] for criterion in criteria}) != POLICY['criteriaCount']
            or any(criterion['node'] not in ['v22.12.0','v24.14.1'] for criterion in criteria)):
        raise ValueError('Pilot transport requires the fixed 32 distinct criteria in ordinal order')
    if (run['id'] != run_id or run['head_sha'] != source_commit or run['run_attempt'] != POLICY['attempt']
            or run['path'] != workflow_path or run['event'] != 'pull_request' or run['status'] != 'completed'
            or run['conclusion'] not in POLICY['terminalStates']):
        raise ValueError('Pilot run is not the selected terminal source/workflow/attempt')
    started = timestamp(run['run_started_at'])
    finished = timestamp(run['updated_at'])
    if finished < started:
        raise ValueError('Pilot run completion precedes its start')
    if jobs['total_count'] != len(jobs['jobs']) or artifacts['total_count'] != len(artifacts['artifacts']):
        raise ValueError('Pilot API pagination is incomplete')
    expected = {'jsdom-pilot-consumption-'+source_commit+'-'+str(run_id)+'-attempt1':('preflight',None)}
    job_names = {'preflight'}
    for criterion in criteria:
        name = 'Criterio '+str(criterion['ordinal'])+' Node '+criterion['node'][1:]
        job_names.add(name)
        expected['jsdom-pilot-criterion-'+str(criterion['ordinal'])+'-'+source_commit+'-'+str(run_id)+'-attempt1'] = (name,criterion['ordinal'])
    by_job = {}
    job_ids = set()
    for job in jobs['jobs']:
        if (job['name'] not in job_names or job['name'] in by_job or type(job['id']) is not int or job['id'] <= 0
                or job['id'] in job_ids or job['head_sha'] != source_commit or job['run_attempt'] != POLICY['attempt']
                or job['status'] != 'completed' or job['conclusion'] not in POLICY['terminalStates']):
            raise ValueError('Pilot job has duplicate or unexpected provenance')
        if not started <= timestamp(job['started_at']) <= timestamp(job['completed_at']) <= finished:
            raise ValueError('Pilot job is outside its terminal run interval')
        by_job[job['name']] = job
        job_ids.add(job['id'])
    names = set()
    identities = set()
    records = []
    for artifact in artifacts['artifacts']:
        if (artifact['name'] not in expected or artifact['name'] in names or type(artifact['id']) is not int
                or artifact['id'] <= 0 or artifact['id'] in identities):
            raise ValueError('Pilot artifact name or identity is unexpected/duplicated')
        job_name,ordinal = expected[artifact['name']]
        job = by_job.get(job_name)
        if job is None:
            raise ValueError('Pilot artifact has no independently listed terminal job')
        if (artifact['workflow_run']['id'] != run_id or artifact['workflow_run']['head_sha'] != source_commit
                or artifact['expired'] is not False or type(artifact['size_in_bytes']) is not int
                or not 0 < artifact['size_in_bytes'] <= runtime.POLICY['maximumArchiveBytes']
                or not isinstance(artifact['digest'],str)
                or not re.fullmatch('sha256:'+POLICY['sha256Pattern'],artifact['digest'])):
            raise ValueError('Pilot artifact is unavailable or has invalid size/digest/source')
        if not timestamp(job['started_at']) <= timestamp(artifact['created_at']) <= timestamp(job['completed_at']):
            raise ValueError('Pilot artifact creation is outside its actual job interval')
        names.add(artifact['name'])
        identities.add(artifact['id'])
        records.append({'metadata':artifact,'jobId':job['id'],'jobName':job_name,
            'jobConclusion':job['conclusion'],'ordinal':ordinal})
    return {'runId':run_id,'attempt':POLICY['attempt'],'sourceCommit':source_commit,'workflowPath':workflow_path,
        'runConclusion':run['conclusion'],'expectedArtifacts':len(expected),'availableArtifacts':len(records),
        'missingArtifactNames':sorted(set(expected)-names),'missingJobNames':sorted(job_names-set(by_job)),
        'allExpectedArtifactsAvailable':names == set(expected),
        'records':sorted(records,key=lambda record:-1 if record['ordinal'] is None else record['ordinal']),
        'measurementExecuted':False,'performanceAccepted':None,'gateReevaluated':False}


def discover(*, run_id, source_commit, workflow_path, criteria):
    """Read exactly one attempt; never dispatch, retry or relabel a workflow."""
    if type(run_id) is not int or run_id <= 0:
        raise ValueError('Pilot discovery requires one positive run ID')
    run = json.loads(api('actions/runs/'+str(run_id)+'/attempts/1','pilot-run'))
    jobs = json.loads(api('actions/runs/'+str(run_id)+'/attempts/1/jobs?per_page='+str(POLICY['pageSize']),'pilot-jobs'))
    artifacts = json.loads(api('actions/runs/'+str(run_id)+'/artifacts?per_page='+str(POLICY['pageSize']),'pilot-artifacts'))
    return metadata_plan(run,jobs,artifacts,run_id=run_id,source_commit=source_commit,workflow_path=workflow_path,criteria=criteria)


def member_path(name):
    """Reject aliases, traversal, links and Windows-incompatible member paths before writing."""
    path = PurePosixPath(name)
    if (not name or path.is_absolute() or path.as_posix() != name or '\\' in name or ':' in name
            or unicodedata.normalize('NFC',name) != name or len(name.encode()) > POLICY['maximumMemberPathBytes']):
        raise ValueError('Pilot ZIP member path is not canonical')
    for component in name.split('/'):
        stem = component.split('.')[0].casefold()
        if (component in ['', '.', '..'] or component.endswith((' ', '.')) or stem in POLICY['reservedNames']
                or any(character in '<>"|?*' or ord(character) < 32 or ord(character) == 127 for character in component)
                or stem in [prefix+str(number) for prefix in POLICY['reservedDevicePrefixes'] for number in range(1,10)]):
            raise ValueError('Pilot ZIP member path is not portable')
    return path


def inventory_zip(filename, destination=None):
    """Read every member/CRC in bounded chunks and optionally extract into one exclusive directory."""
    if filename.is_symlink() or not filename.is_file():
        raise ValueError('Pilot ZIP must be a physical file')
    with zipfile.ZipFile(filename) as archive:
        members = archive.infolist()
        if not 0 < len(members) <= POLICY['maximumMembers']:
            raise ValueError('Pilot ZIP has an invalid member count')
        namespace = set()
        files = {}
        total = 0
        for member in members:
            if member.orig_filename != member.filename:
                raise ValueError('Pilot ZIP member name was normalized')
            name = member.filename[:-1] if member.is_dir() else member.filename
            member_path(name)
            kind = stat.S_IFMT(member.external_attr >> 16)
            if member.flag_bits & 1 or kind not in [0,stat.S_IFREG,stat.S_IFDIR] or name.casefold() in namespace:
                raise ValueError('Pilot ZIP contains duplicate, linked, encrypted or special members')
            if ((member.is_dir() and (member.file_size != 0 or kind not in [0,stat.S_IFDIR]))
                    or (not member.is_dir() and kind == stat.S_IFDIR)):
                raise ValueError('Pilot ZIP directory type or payload is inconsistent')
            namespace.add(name.casefold())
            if member.is_dir():
                continue
            if not 0 <= member.file_size <= POLICY['maximumMemberBytes']:
                raise ValueError('Pilot ZIP member exceeds the declared byte bound')
            total += member.file_size
            if total > POLICY['maximumExpandedBytes']:
                raise ValueError('Pilot ZIP exceeds the expanded byte bound')
            files[name] = member
        folded_files = {name.casefold() for name in files}
        for name in namespace:
            if any(parent.as_posix().casefold() in folded_files for parent in PurePosixPath(name).parents if parent.as_posix() != '.'):
                raise ValueError('Pilot ZIP has a file/directory collision')
        if destination is not None:
            destination = Path(destination)
            for parent in [destination.absolute(),*destination.absolute().parents]:
                if parent.is_symlink():
                    raise ValueError('Pilot ZIP output contains a linked ancestor')
            canonical = destination.resolve()
            if canonical.is_relative_to(runtime.SOURCE) or runtime.SOURCE.is_relative_to(canonical):
                raise ValueError('Pilot ZIP extraction must remain outside the producer checkout and its ancestors')
            if filename.resolve().is_relative_to(canonical):
                raise ValueError('Pilot ZIP output contains its archive')
            destination.mkdir(parents=True,exist_ok=False)
        records = []
        for name,member in files.items():
            target = None
            if destination is not None:
                target_path = destination.joinpath(*PurePosixPath(name).parts)
                target_path.parent.mkdir(parents=True,exist_ok=True)
                target = target_path.open('xb')
            checksum = hashlib.sha256()
            count = 0
            try:
                with archive.open(member) as reader:
                    for chunk in iter(lambda:reader.read(runtime.POLICY['readChunkBytes']),b''):
                        count += len(chunk)
                        if count > member.file_size:
                            raise ValueError('Pilot ZIP member exceeds its declared size')
                        checksum.update(chunk)
                        if target is not None and target.write(chunk) != len(chunk):
                            raise OSError('Pilot ZIP extraction short write')
            finally:
                if target is not None:
                    target.close()
            if count != member.file_size:
                raise ValueError('Pilot ZIP member is incomplete')
            records.append({'path':name,'bytes':count,'crc32':member.CRC,'sha256':checksum.hexdigest()})
    return records


def receive(record):
    """Reauthenticate immutable artifact metadata and retain every partial download on failure."""
    metadata = record['metadata']
    identity = str(metadata['id'])
    if json.loads(api('actions/artifacts/'+identity,'metadata-'+identity)) != metadata:
        raise ValueError('Pilot artifact metadata changed since discovery')
    result = stream.download([str(runtime.NATIVE_CLI),'api','repos/'+POLICY['repository']+'/actions/artifacts/'+identity+'/zip'],
        'zip-'+identity,expected_bytes=metadata['size_in_bytes'])
    filename = result['stdout']
    checksum = runtime.checksum_path(filename)
    if metadata['digest'] != 'sha256:'+checksum:
        raise ValueError('Pilot original ZIP differs from its API digest; raw bytes retained')
    members = inventory_zip(filename)
    return {'id':metadata['id'],'name':metadata['name'],'bytes':metadata['size_in_bytes'],'sha256':checksum,
        'ordinal':record['ordinal'],'jobId':record['jobId'],'jobConclusion':record['jobConclusion'],
        'originalPath':filename.relative_to(runtime.OUTPUT).as_posix(),'members':members,
        'measurementExecuted':False,'archivedCodeExecuted':False}
