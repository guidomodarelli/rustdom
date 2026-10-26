from pathlib import Path
import json
import shutil
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Expanded CI fix qualification requires non-optimized Python')

repository = Path(__file__).resolve().parent.parent
data = Path('C:/Users/guido/.codex/worktrees/pilot-v2-ci-evidence/rustdom')
workspace = Path('C:/rd-ci-q-20261026')
short_root = sys.argv[1:] == ['--resume-short-root']
resume = sys.argv[1:] == ['--resume-explicit-autocrlf'] or short_root
assert not sys.argv[1:] or resume
if not resume:
    assert not workspace.exists()
    assert shutil.disk_usage(repository).free > 800_000_000
    workspace.mkdir()
else:
    assert workspace.is_dir()
output = repository/'.cache/expanded-ci-fix-qualification'
previous = output
if resume: output = output/('explicit-autocrlf-short-root' if short_root else 'explicit-autocrlf')
output.mkdir(exist_ok=False)
base = repository/'reports/validation/jsdom-block-pilot-v2/ci-57c3c2c9'
layout = json.loads((base/'expanded-artifact-layout.json').read_bytes())
records = []
for artifact in layout['artifacts']:
    artifact_id = str(artifact['artifactId'])
    archive = repository/'.cache/pilot-method-hosted-40375966913'/(artifact_id+'.zip')
    assert archive.is_file()
    destination = workspace/artifact_id
    if resume:
        record = json.loads((previous/(artifact_id+'.json')).read_bytes())
        assert record['files'] == artifact['expandedFiles'] and record['allMemberDigestsVerified']
        records.append(record)
        if record['files'] > 5: continue
        destination = workspace/('small2' if short_root else 'reviewed-small')/artifact_id
    with (output/(artifact_id+'.json')).open('xb') as stdout, (output/(artifact_id+'.stderr')).open('xb') as stderr:
        result = subprocess.run([sys.executable,str(base/'materialize-ci-artifact.py'),str(data),artifact_id,
            str(archive),str(destination)],stdout=stdout,stderr=stderr,timeout=180)
    assert result.returncode == 0, artifact_id
    record = json.loads((output/(artifact_id+'.json')).read_bytes())
    assert record['files'] == artifact['expandedFiles'] and record['allMemberDigestsVerified']
    if not resume: records.append(record)
git = ['git','-c','gc.auto=0','-c','maintenance.auto=false','-c','core.autocrlf=false']
retired = json.loads((repository/'.cache/expanded-ci-retirement-directories.json').read_bytes())
paths = subprocess.check_output(git+['ls-tree','-r','--name-only','HEAD'],cwd=repository).decode().splitlines()
bad = max((path for path in paths if any(path.startswith(directory+'/') for directory in retired)),key=len)
safe = max((path for path in paths if not any(path.startswith(directory+'/') for directory in retired)),key=len)
fixture = workspace/('g2' if short_root else 'git-explicit-autocrlf' if resume else 'git')
subprocess.run(git+['init','-q',str(fixture)],check=True)
identity = subprocess.check_output(git+['var','GIT_AUTHOR_IDENT'],cwd=repository).strip()
payloads = [subprocess.check_output(git+['cat-file','blob','HEAD:'+path],cwd=repository) for path in [bad,safe]]
stream = b''
for index,payload in enumerate(payloads,1):
    stream += b'blob\nmark :'+str(index).encode()+b'\ndata '+str(len(payload)).encode()+b'\n'+payload+b'\n'
stream += b'commit refs/heads/long-before\ncommitter '+identity+b'\ndata 0\n\n'
stream += b'M 100644 :1 '+json.dumps(bad).encode()+b'\nM 100644 :2 '+json.dumps(safe).encode()+b'\n\n'
stream += b'commit refs/heads/short-after\ncommitter '+identity+b'\ndata 0\n\nfrom refs/heads/long-before\nD '+json.dumps(bad).encode()+b'\n\ndone\n'
imported = subprocess.run(git+['fast-import','--quiet'],cwd=fixture,input=stream,capture_output=True,timeout=60)
(output/'git-import.stdout').write_bytes(imported.stdout)
(output/'git-import.stderr').write_bytes(imported.stderr)
assert imported.returncode == 0
for branch in ['long-before','short-after']:
    result = subprocess.run(git+['-c','core.longpaths=false','checkout','-f',branch],cwd=fixture,capture_output=True,timeout=60)
    (output/(branch+'.stdout')).write_bytes(result.stdout)
    (output/(branch+'.stderr')).write_bytes(result.stderr)
    if branch == 'long-before':
        assert result.returncode != 0 and b'Filename too long' in result.stderr
    else:
        assert result.returncode == 0
        assert (fixture/safe).read_bytes() == payloads[1]
summary = {'sourceCommit':'525e2be66edba26846582be67d0087418d64312c',
    'windowsOriginalArtifactsMaterialized':len(records),'expandedFilesVerified':sum(record['files'] for record in records),
    'records':records,'realWindowsGitLongPathsDisabled':True,'originalLongCheckoutReproduced':True,
    'shortCheckoutPassed':True,'longRelativePathBytes':len(bad.encode()),'retainedRelativePathBytes':len(safe.encode()),
    'python':sys.version,'DOMExecuted':False,'archivedCodeExecuted':False,'scientificCaptureExecuted':False}
summary['initialFixtureAutocrlfMismatchPreserved'] = resume
summary['currentCliPositiveSmallOriginalArchives'] = 2 if resume else 0
summary['fixtureRootShortenedAfterLongRootFailure'] = short_root
(output/'summary.json').write_bytes(json.dumps(summary,indent=2).encode()+b'\n')
print(json.dumps(summary),flush=True)
