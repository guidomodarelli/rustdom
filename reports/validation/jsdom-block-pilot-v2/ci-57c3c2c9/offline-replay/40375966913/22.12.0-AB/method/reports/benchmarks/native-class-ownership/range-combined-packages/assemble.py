"""Materialize independently qualified runtime bytes without rebuilding, installing or running DOM."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile
import stat

from artifact import digest, inspect_collection

if sys.flags.optimize:
    raise RuntimeError('Combined package assembly requires non-optimized Python')

SOURCE = Path(__file__).resolve().parent
REPOSITORY = SOURCE.parents[3]
POLICY = json.loads((SOURCE / 'constants/assembly.json').read_bytes())
SOURCE_BINDING = json.loads((SOURCE / 'constants/source-binding.json').read_bytes())


def run_node(node, script, *arguments):
    """Read a current verifier using one independently pinned official Linux SDK."""
    assert sys.platform == 'linux', 'Combined assembly: prepare Linux links on Linux'
    node = node.resolve(strict=True)
    assert digest(node) in POLICY['nodeHashes'], 'Combined assembly: unsupported Node bytes'
    version = subprocess.check_output([str(node), '--version'], timeout=POLICY['commandTimeoutSeconds']).decode().strip()
    assert version in POLICY['nodeVersions'], 'Combined assembly: unsupported Node version'
    result = subprocess.run([str(node), str(SOURCE / script), *map(str, arguments)], capture_output=True,
                            timeout=POLICY['commandTimeoutSeconds'])
    assert result.returncode == 0, 'Combined assembly: verifier failed ' + script + ': ' + result.stderr.decode('utf-8', errors='replace')
    return json.loads(result.stdout)


def source_files(root):
    """Enumerate all declared compiler files, rejecting links and preserving relative names."""
    files = {}
    for relative in POLICY['sourceRoots']:
        member = root / relative
        assert not member.is_symlink() and member.exists(), 'Combined assembly: missing or linked source ' + relative
        members = member.rglob('*') if member.is_dir() else [member]
        for file in members:
            assert not file.is_symlink(), 'Combined assembly: linked compiler input'
            if file.is_file():
                assert file.stat().st_nlink == 1, 'Combined assembly: shared compiler input'
                files[file.relative_to(root).as_posix()] = digest(file)
    return dict(sorted(files.items()))


def verify_sources(root, node, compiler_checkout=False):
    """Compare independent compiler bytes and actual Git metadata without replacing unavailable provenance."""
    assert SOURCE_BINDING['complete'], 'Combined assembly: source binding is not published yet'
    assert source_files(root) == SOURCE_BINDING['files'], 'Combined assembly: changed compiler sources'
    identity = run_node(node, 'source-identity.cjs', root)
    assert identity['sourceHash'] == SOURCE_BINDING['identity']['sourceHash'], 'Combined assembly: changed measured source hash'
    assert identity['measuredSources'] == SOURCE_BINDING['identity']['measuredSources']
    if compiler_checkout:
        assert (root / '.git').is_dir() and not (root / '.git').is_symlink(), 'Combined assembly: use a real source Git directory'
        assert identity == SOURCE_BINDING['identity'], 'Combined assembly: changed actual compiler Git provenance'
    return identity


def candidate_files(root):
    """Read the complete physical runtime copy; allow only its explicit shared dependency link."""
    files = []
    for file in root.rglob('*'):
        relative = file.relative_to(root).as_posix()
        if file.is_symlink():
            assert relative == 'node_modules' and file.readlink().as_posix() == POLICY['candidateDependencyLink']
        elif file.is_file():
            assert file.stat().st_nlink == 1, 'Combined assembly: independent candidate runtime files required'
            files.append({'path': relative, 'bytes': file.stat().st_size, 'sha256': digest(file)})
    return sorted(files, key=lambda entry: entry['path'])


def verify(root, collection, node):
    """Authenticate every assembled member against published transport and independent baseline/source bindings."""
    root = root.resolve(strict=True)
    assert {entry.name for entry in root.iterdir()} == set(POLICY['paths'].values()), 'Combined assembly: unexpected root members'
    for key in POLICY['directoryPathKeys']:
        directory = root / POLICY['paths'][key]
        assert stat.S_ISDIR(directory.lstat().st_mode) and directory.resolve(strict=True).is_relative_to(root), \
            'Combined assembly: physical internal directory required: ' + key
    for key in POLICY['filePathKeys']:
        member = root / POLICY['paths'][key]
        status = member.lstat()
        assert stat.S_ISREG(status.st_mode) and status.st_nlink == 1, 'Combined assembly: physical metadata file required: ' + key
    selected = inspect_collection(REPOSITORY, collection)
    index = json.loads((root / POLICY['paths']['index']).read_bytes())
    assert index['complete'] and index['revision'] == POLICY['revision'] and 'failure' not in index
    for field in ['runtimeExecuted', 'benchmarkExecuted', 'installExecuted', 'rustRebuilt', 'gateReevaluated']:
        assert index[field] is False
    assert index['performanceAccepted'] is None
    controls = run_node(node, 'baselines.cjs', '--verify', root / POLICY['paths']['controls'])
    assert controls == index['controlsIdentity'], 'Combined assembly: changed controls identity'
    candidate = root / POLICY['paths']['candidate']
    expected = [{key: entry[key] for key in ['path', 'bytes', 'sha256']} for entry in selected['selectedFiles']]
    assert candidate_files(candidate) == expected, 'Combined assembly: changed candidate distribution'
    assert (candidate / 'node_modules').is_symlink()
    assert (candidate / 'node_modules').resolve(strict=True) == (root / POLICY['paths']['controls'] / 'node_modules').resolve(strict=True)
    assert json.loads((root / POLICY['paths']['artifactReceipt']).read_bytes()) == selected
    snapshot = verify_sources(root / POLICY['paths']['sources'], node)
    assert snapshot == index['sourceSnapshotIdentity'], 'Combined assembly: preserve actual snapshot Git metadata'
    assert index['compilerSourceIdentity'] == SOURCE_BINDING['identity']
    return {'verified': True, 'revision': POLICY['revision'], 'artifactId': selected['artifactId'],
            'binarySha256': selected['binarySha256'], 'candidateFiles': len(expected),
            'controlsIdentity': controls, 'sourceSnapshotIdentity': snapshot,
            'compilerSourceIdentity': SOURCE_BINDING['identity'], 'runtimeExecuted': False,
            'benchmarkExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False}


def prepare(baselines, collection, compiler_source, destination, node):
    """Copy independent controls, sources and the selected hosted distribution into a fresh disjoint directory."""
    assert sys.platform == 'linux', 'Combined assembly: prepare Linux package links on Linux'
    baselines, collection, compiler_source = [root.resolve(strict=True) for root in [baselines, collection, compiler_source]]
    destination = destination.parent.resolve(strict=True) / destination.name
    assert not destination.exists() and not destination.is_symlink(), 'Combined assembly: preserve existing output'
    for protected in [REPOSITORY, baselines, collection, compiler_source]:
        assert destination != protected and not destination.is_relative_to(protected) and not protected.is_relative_to(destination), \
            'Combined assembly: output overlaps a protected input'
    selected = inspect_collection(REPOSITORY, collection)
    controls_before = run_node(node, 'baselines.cjs', '--verify', baselines)
    compiler_before = verify_sources(compiler_source, node, compiler_checkout=True)
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
        archive_path = collection / ('artifact-' + str(selected['artifactId'])) / 'artifact.zip'
        with zipfile.ZipFile(archive_path) as archive:
            for member in selected['selectedFiles']:
                relative = Path(member['path'])
                assert not relative.is_absolute() and '..' not in relative.parts and ':' not in member['path']
                target = candidate / relative; target.parent.mkdir(parents=True, exist_ok=True)
                with target.open('xb') as stream:
                    stream.write(archive.read(member['archivePath']))
        (candidate / 'node_modules').symlink_to(POLICY['candidateDependencyLink'], target_is_directory=True)
        sources = destination / POLICY['paths']['sources']; sources.mkdir()
        for relative in SOURCE_BINDING['files']:
            target = sources / relative; target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(compiler_source / relative, target)
        index.update({'controlsIdentity': run_node(node, 'baselines.cjs', '--verify', destination / POLICY['paths']['controls']),
                      'compilerSourceIdentity': compiler_before, 'sourceSnapshotIdentity': verify_sources(sources, node)})
        assert run_node(node, 'baselines.cjs', '--verify', baselines) == controls_before
        assert verify_sources(compiler_source, node, compiler_checkout=True) == compiler_before
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
        assert len(sys.argv) == 7 and sys.argv[1] == '--prepare', 'Provide --prepare baselines collection compiler-source output node, or --verify output collection node'
        print(json.dumps(prepare(*map(Path, sys.argv[2:]))))
