"""Assemble the authenticated hosted runtime with immutable controls and separately identified canonical sources."""
import json
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import zipfile

from artifact import digest, inspect_collection

if sys.flags.optimize:
    raise RuntimeError('Owner batch assembly requires non-optimized Python')
SOURCE = Path(__file__).resolve().parent
REPOSITORY = SOURCE.parents[3]
POLICY = json.loads((SOURCE / 'constants/assembly.json').read_bytes())
assert digest(SOURCE / 'constants/source.json') == POLICY['sourceBindingSha256'], 'Owner batch assembly: changed source binding'
BINDING = json.loads((SOURCE / 'constants/source.json').read_bytes())


def read_node(node, script, *arguments):
    """Execute only current pinned read-only verifiers using an official SDK, never copied archive helpers."""
    node = node.resolve(strict=True)
    assert digest(node) in POLICY['nodeHashes'], 'Owner batch assembly: unsupported Node bytes'
    version = subprocess.check_output([str(node), '--version'], timeout=POLICY['commandTimeoutSeconds']).decode().strip()
    assert version in POLICY['nodeVersions'], 'Owner batch assembly: unsupported Node version'
    script_path = REPOSITORY / script
    assert digest(script_path) == POLICY['readerFiles'][script], 'Owner batch assembly: changed current verifier'
    result = subprocess.run([str(node), str(script_path), *map(str, arguments)], capture_output=True,
                            timeout=POLICY['commandTimeoutSeconds'])
    assert result.returncode == 0, 'Owner batch assembly: verifier failed: ' + result.stderr.decode(errors='replace')
    return json.loads(result.stdout)


def source_files(root):
    """Read all declared compiler inputs, requiring independent physical files."""
    files = {}
    for relative in BINDING['sourceRoots']:
        member = root / relative
        assert member.exists() and not member.is_symlink(), 'Owner batch assembly: missing source ' + relative
        for filename in member.rglob('*') if member.is_dir() else [member]:
            assert not filename.is_symlink(), 'Owner batch assembly: source links unsupported'
            if filename.is_file():
                assert filename.stat().st_nlink == 1
                files[filename.relative_to(root).as_posix()] = digest(filename)
    return dict(sorted(files.items()))


def sources(root, node, canonical=False):
    """Distinguish local canonical reproduction from the independently preserved hosted compiler qualification."""
    assert source_files(root) == BINDING['files'], 'Owner batch assembly: changed canonical compiler inputs'
    identity = read_node(node, POLICY['sourceReader'], root)
    expected = BINDING['canonicalReproductionIdentity']
    assert identity['sourceHash'] == expected['sourceHash'] and identity['measuredSources'] == expected['measuredSources']
    if canonical:
        assert (root / '.git').is_dir() and not (root / '.git').is_symlink()
        assert identity == expected, 'Owner batch assembly: changed actual local canonical Git metadata'
    return identity


def runtime_files(root):
    """Read physical runtime members and its one explicit relative dependency link."""
    files = []
    for filename in root.rglob('*'):
        relative = filename.relative_to(root).as_posix()
        if filename.is_symlink():
            assert relative == 'node_modules' and filename.readlink().as_posix() == POLICY['candidateDependencyLink']
        elif filename.is_file():
            assert filename.stat().st_nlink == 1
            files.append({'path': relative, 'bytes': filename.stat().st_size, 'sha256': digest(filename)})
    return sorted(files, key=lambda entry: entry['path'])


def verify(root, collection, node):
    """Authenticate the entire assembled payload and both source provenances without executing a DOM."""
    root = root.resolve(strict=True)
    assert {entry.name for entry in root.iterdir()} == set(POLICY['paths'].values())
    for key in ['controls', 'candidate', 'sources']:
        filename = root / POLICY['paths'][key]
        assert stat.S_ISDIR(filename.lstat().st_mode) and filename.resolve(strict=True).is_relative_to(root)
    for key in ['index', 'artifactReceipt']:
        filename = root / POLICY['paths'][key]
        assert stat.S_ISREG(filename.lstat().st_mode) and filename.stat().st_nlink == 1
    selected = inspect_collection(REPOSITORY, collection)
    index = json.loads((root / POLICY['paths']['index']).read_bytes())
    assert index['complete'] is True and index['revision'] == POLICY['revision'] and 'failure' not in index
    for field in ['runtimeExecuted', 'benchmarkExecuted', 'installExecuted', 'rustRebuilt', 'gateReevaluated']:
        assert index[field] is False
    assert index['performanceAccepted'] is None
    controls = read_node(node, POLICY['baselineReader'], '--verify', root / POLICY['paths']['controls'])
    assert controls == index['controlsIdentity'], 'Owner batch assembly: changed control payload'
    candidate = root / POLICY['paths']['candidate']
    expected = [{key: entry[key] for key in ['path', 'bytes', 'sha256']} for entry in selected['selectedFiles']]
    assert runtime_files(candidate) == expected, 'Owner batch assembly: changed hosted runtime'
    assert (candidate / 'node_modules').is_symlink()
    assert (candidate / 'node_modules').resolve(strict=True) == (root / POLICY['paths']['controls'] / 'node_modules').resolve(strict=True)
    assert json.loads((root / POLICY['paths']['artifactReceipt']).read_bytes()) == selected
    snapshot = sources(root / POLICY['paths']['sources'], node)
    assert snapshot == index['sourceSnapshotIdentity'], 'Owner batch assembly: changed actual source snapshot metadata'
    assert index['canonicalReproductionIdentity'] == BINDING['canonicalReproductionIdentity']
    assert index['hostedCompilerQualification'] == selected['qualification']
    assert index['canonicalReproductionIsHostedCompiler'] is False
    return {'verified': True, 'revision': POLICY['revision'], 'artifactId': selected['artifactId'],
            'binarySha256': selected['binarySha256'], 'candidateFiles': len(expected), 'sourceFiles': len(BINDING['files']),
            'controlsIdentity': controls, 'sourceSnapshotIdentity': snapshot,
            'canonicalReproductionIdentity': BINDING['canonicalReproductionIdentity'],
            'canonicalReproductionIsHostedCompiler': False, 'runtimeExecuted': False,
            'benchmarkExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False}


def prepare(baselines, collection, canonical_source, destination, node):
    """Copy immutable inputs to a new disjoint Linux package; no install, build or archived script execution."""
    assert sys.platform == 'linux', 'Owner batch assembly: create relative package links on Linux'
    baselines, collection, canonical_source = [member.resolve(strict=True) for member in [baselines, collection, canonical_source]]
    destination = destination.parent.resolve(strict=True) / destination.name
    assert not destination.exists() and not destination.is_symlink(), 'Owner batch assembly: preserve existing output'
    for protected in [REPOSITORY, baselines, collection, canonical_source]:
        assert destination != protected and not destination.is_relative_to(protected) and not protected.is_relative_to(destination)
    selected = inspect_collection(REPOSITORY, collection)
    controls_before = read_node(node, POLICY['baselineReader'], '--verify', baselines)
    canonical_before = sources(canonical_source, node, canonical=True)
    index = {'revision': POLICY['revision'], 'complete': False, 'runtimeExecuted': False,
             'benchmarkExecuted': False, 'installExecuted': False, 'rustRebuilt': False,
             'performanceAccepted': None, 'gateReevaluated': False}
    destination.mkdir()
    def save():
        (destination / POLICY['paths']['index']).write_text(json.dumps(index, indent=2) + '\n', encoding='utf-8', newline='\n')
    save()
    try:
        shutil.copytree(baselines, destination / POLICY['paths']['controls'], symlinks=True)
        candidate = destination / POLICY['paths']['candidate']; candidate.mkdir()
        with zipfile.ZipFile(collection / ('artifact-' + str(selected['artifactId'])) / 'artifact.zip') as archive:
            for member in selected['selectedFiles']:
                relative = Path(member['path'])
                assert not relative.is_absolute() and '..' not in relative.parts and ':' not in member['path']
                target = candidate / relative; target.parent.mkdir(parents=True, exist_ok=True)
                with target.open('xb') as stream:
                    stream.write(archive.read(member['archivePath']))
        (candidate / 'node_modules').symlink_to(POLICY['candidateDependencyLink'], target_is_directory=True)
        snapshot = destination / POLICY['paths']['sources']; snapshot.mkdir()
        for relative in BINDING['files']:
            target = snapshot / relative; target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(canonical_source / relative, target)
        index.update(controlsIdentity=read_node(node, POLICY['baselineReader'], '--verify', destination / POLICY['paths']['controls']),
                     canonicalReproductionIdentity=canonical_before, sourceSnapshotIdentity=sources(snapshot, node),
                     hostedCompilerQualification=selected['qualification'], canonicalReproductionIsHostedCompiler=False)
        assert read_node(node, POLICY['baselineReader'], '--verify', baselines) == controls_before
        assert sources(canonical_source, node, canonical=True) == canonical_before
        (destination / POLICY['paths']['artifactReceipt']).write_text(json.dumps(selected, indent=2) + '\n', encoding='utf-8', newline='\n')
        index['complete'] = True; save()
        return verify(destination, collection, node)
    except Exception as error:
        index['complete'] = False; index['failure'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        save()


if __name__ == '__main__':
    if len(sys.argv) == 5 and sys.argv[1] == '--verify':
        print(json.dumps(verify(*map(Path, sys.argv[2:]))))
    else:
        assert len(sys.argv) == 7 and sys.argv[1] == '--prepare', 'Provide --prepare controls collection canonical-source output node, or --verify output collection node'
        print(json.dumps(prepare(*map(Path, sys.argv[2:]))))
