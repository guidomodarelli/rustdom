"""Assemble an exact qualified hosted runtime with independent controls, without executing a DOM or rebuilding."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import types
import zipfile

if sys.flags.optimize:
    raise RuntimeError('Numeric package authentication requires non-optimized Python')

SOURCE = Path(__file__).resolve().parent
REPOSITORY = SOURCE.parents[3]
POLICY = json.loads((SOURCE / 'constants/package.json').read_bytes())

def digest(path):
    checksum = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1048576), b''):
            checksum.update(chunk)
    return checksum.hexdigest()

def verify_reader_graph(repository=REPOSITORY):
    """Authenticate the complete frozen transitive reader graph before any JavaScript entrypoint executes."""
    binding = POLICY['readerGraph']
    receipt = repository / binding['path']
    assert not receipt.is_symlink() and digest(receipt) == binding['sha256']
    files = json.loads(receipt.read_bytes())['files']
    assert len(files) == binding['files']
    for relative, expected in files.items():
        member = repository / relative
        assert member.is_file() and not member.is_symlink() and member.resolve(strict=True).is_relative_to(repository.resolve(strict=True)), relative
        assert digest(member) == expected, relative
    for key in ['baselineReader', 'sourceReader']:
        assert files[POLICY[key]['path']] == POLICY[key]['sha256']
    return {'verified': True, 'files': len(files)}

def current_module(binding):
    """Compile the exact reviewed source buffer rather than trusting timestamp-valid Python caches."""
    location = REPOSITORY / binding['path']
    assert location.is_file() and not location.is_symlink()
    raw = location.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == binding['sha256']
    module = types.ModuleType('numeric_package_current_reader')
    module.__file__ = str(location)
    exec(compile(raw, str(location), 'exec'), module.__dict__)
    return module

def node_read(node, binding, *arguments):
    """Run only a pinned current read-only identity verifier with an authenticated SDK."""
    node = node.resolve(strict=True)
    assert digest(node) in POLICY['nodeHashes']
    version = subprocess.check_output([str(node), '--version'], timeout=POLICY['commandTimeoutSeconds']).decode().strip()
    assert version in POLICY['nodes']
    verify_reader_graph()
    script = REPOSITORY / binding['path']
    assert digest(script) == binding['sha256']
    result = subprocess.run([str(node), str(script), *map(str, arguments)], capture_output=True, timeout=POLICY['commandTimeoutSeconds'])
    if result.returncode:
        raise RuntimeError('Numeric package identity reader failed: ' + binding['path'] + '\n' + result.stderr.decode(errors='replace'))
    return json.loads(result.stdout)

def declared_sources(root):
    binding = POLICY['inputs']
    declaration = REPOSITORY / binding['path']
    assert digest(declaration) == binding['sha256']
    expected = json.loads(declaration.read_bytes())['candidateInputs']
    assert len(expected) == POLICY['compilerInputCount']
    for relative, checksum in expected.items():
        member = root / relative
        assert member.is_file() and not member.is_symlink() and member.stat().st_nlink == 1, relative
        assert member.resolve(strict=True).is_relative_to(root.resolve(strict=True)), relative
        assert digest(member) == checksum, relative
    return expected

def hosted():
    """Authenticate the selected SDK/platform artifact and its complete functional qualification."""
    for binding in POLICY['hostedInputs']:
        assert digest(REPOSITORY / binding['path']) == binding['sha256']
    reader = current_module(POLICY['hostedReader'])
    directory = REPOSITORY / POLICY['artifactDirectory']
    result = reader.verify_artifact(REPOSITORY, directory, POLICY['artifactId'])
    assert result['functionalQualified'] is True and result['kind'] == 'numeric'
    assert result['run'] == POLICY['run'] and result['node'] == POLICY['selectedNode'] and result['platform'] == 'linux'
    assert result['nativeBinarySha256'] == POLICY['nativeBinarySha256']
    return result

def runtime_members():
    """Read all distribution/types/package bytes from the independently authenticated hosted ZIP."""
    archive = REPOSITORY / POLICY['artifactDirectory'] / 'artifact.zip'
    with zipfile.ZipFile(archive) as bundle:
        prefixes = [name[:-len('dist/native-build.json')] for name in bundle.namelist()
                    if name.endswith('/artifacts/range-initialization-source/dist/native-build.json')]
        assert len(prefixes) == 1
        prefix = prefixes[0]
        files = {}
        for name in bundle.namelist():
            if name.startswith(prefix) and not name.endswith('/'):
                relative = name[len(prefix):]
                if relative == 'package.json' or relative.startswith(('dist/', 'types/')):
                    assert relative not in files
                    files[relative] = bundle.read(name)
        assert len(files) == POLICY['runtimeFiles']
        assert hashlib.sha256(files['dist/rustdom.node']).hexdigest() == POLICY['nativeBinarySha256']
        return files

def verify(root, node):
    """Recheck every control, runtime byte, declared input and actual transported Git identity."""
    assert not root.is_symlink()
    root = root.resolve(strict=True)
    assert set(member.name for member in root.iterdir()) == set(POLICY['paths'].values())
    for key in ['controls', 'candidate', 'sources']:
        assert (root / POLICY['paths'][key]).is_dir() and not (root / POLICY['paths'][key]).is_symlink()
    for key in ['index', 'hosted']:
        member = root / POLICY['paths'][key]
        assert member.is_file() and not member.is_symlink() and member.stat().st_nlink == 1
    index = json.loads((root / POLICY['paths']['index']).read_bytes())
    assert index['complete'] is True and index['revision'] == POLICY['revision'] and 'failure' not in index
    for field in ['runtimeExecuted', 'benchmarkExecuted', 'installExecuted', 'rustRebuilt', 'gateReevaluated']:
        assert index[field] is False
    assert index['performanceAccepted'] is None
    selected = hosted()
    assert json.loads((root / POLICY['paths']['hosted']).read_bytes()) == selected
    controls = node_read(node, POLICY['baselineReader'], '--verify', root / POLICY['paths']['controls'])
    assert controls == index['controlsIdentity']
    candidate = root / POLICY['paths']['candidate']
    files = runtime_members()
    actual = {}
    for member in candidate.rglob('*'):
        relative = member.relative_to(candidate).as_posix()
        if member.is_symlink():
            assert relative == 'node_modules' and member.readlink().as_posix() == POLICY['dependencyLink']
        elif member.is_file():
            assert member.stat().st_nlink == 1 and relative in files
            assert member.read_bytes() == files[relative], relative
            actual[relative] = digest(member)
    assert set(actual) == set(files)
    dependencies = candidate / 'node_modules'
    assert dependencies.is_symlink() and dependencies.resolve(strict=True) == (root / POLICY['paths']['controls'] / 'node_modules').resolve(strict=True)
    expected_sources = declared_sources(root / POLICY['paths']['sources'])
    actual_sources = set()
    for member in (root / POLICY['paths']['sources']).rglob('*'):
        assert not member.is_symlink() and (member.is_dir() or member.is_file()), 'Source snapshot must contain only physical files/directories'
        if member.is_file():
            actual_sources.add(member.relative_to(root / POLICY['paths']['sources']).as_posix())
    assert actual_sources == set(expected_sources)
    identity = node_read(node, POLICY['sourceReader'], root / POLICY['paths']['sources'])
    assert identity == index['sourceSnapshotIdentity']
    return {'verified': True, 'revision': POLICY['revision'], 'artifactId': POLICY['artifactId'],
        'nativeBinarySha256': POLICY['nativeBinarySha256'], 'runtimeFiles': len(actual), 'declaredCompilerInputs': len(expected_sources),
        'controlsIdentity': controls, 'sourceSnapshotIdentity': identity,
        'canonicalReproductionIdentity': index['canonicalReproductionIdentity'],
        'canonicalReproductionIsHostedCompiler': False, 'runtimeExecuted': False,
        'benchmarkExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False}

def prepare(controls, canonical_source, destination, node):
    """Create independent physical copies in a new disjoint Linux directory; preserve all original inputs."""
    assert sys.platform == 'linux'
    assert not controls.is_symlink() and not canonical_source.is_symlink()
    controls, canonical_source = controls.resolve(strict=True), canonical_source.resolve(strict=True)
    destination = destination.parent.resolve(strict=True) / destination.name
    assert not destination.exists() and not destination.is_symlink()
    for protected in [REPOSITORY, controls, canonical_source]:
        assert destination != protected and not destination.is_relative_to(protected) and not protected.is_relative_to(destination)
    selected = hosted()
    controls_before = node_read(node, POLICY['baselineReader'], '--verify', controls)
    source_files = declared_sources(canonical_source)
    assert (canonical_source / '.git').is_dir() and not (canonical_source / '.git').is_symlink()
    canonical_identity = node_read(node, POLICY['sourceReader'], canonical_source)
    assert canonical_identity['sourceCommit'] == POLICY['baseCommit'] and canonical_identity['sourceGitErrors'] == []
    destination.mkdir()
    index = {'revision': POLICY['revision'], 'complete': False, 'runtimeExecuted': False,
        'benchmarkExecuted': False, 'installExecuted': False, 'rustRebuilt': False,
        'performanceAccepted': None, 'gateReevaluated': False}
    def save():
        (destination / POLICY['paths']['index']).write_text(json.dumps(index, indent=2) + '\n', encoding='utf-8', newline='\n')
    save()
    try:
        shutil.copytree(controls, destination / POLICY['paths']['controls'], symlinks=True)
        candidate = destination / POLICY['paths']['candidate']; candidate.mkdir()
        for relative, contents in runtime_members().items():
            target = candidate / relative; target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as stream:
                stream.write(contents)
        (candidate / 'node_modules').symlink_to(POLICY['dependencyLink'], target_is_directory=True)
        snapshot = destination / POLICY['paths']['sources']; snapshot.mkdir()
        for relative in source_files:
            target = snapshot / relative; target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(canonical_source / relative, target)
        index.update(controlsIdentity=node_read(node, POLICY['baselineReader'], '--verify', destination / POLICY['paths']['controls']),
            canonicalReproductionIdentity=canonical_identity, sourceSnapshotIdentity=node_read(node, POLICY['sourceReader'], snapshot))
        assert node_read(node, POLICY['baselineReader'], '--verify', controls) == controls_before
        assert declared_sources(canonical_source) == source_files
        assert node_read(node, POLICY['sourceReader'], canonical_source) == canonical_identity
        (destination / POLICY['paths']['hosted']).write_text(json.dumps(selected, indent=2) + '\n', encoding='utf-8', newline='\n')
        index['complete'] = True; save()
        return verify(destination, node)
    except Exception as error:
        index['complete'] = False
        index['failure'] = {'type': type(error).__name__, 'message': str(error)}
        save()
        raise

if __name__ == '__main__':
    if len(sys.argv) == 4 and sys.argv[1] == '--verify':
        print(json.dumps(verify(Path(sys.argv[2]), Path(sys.argv[3]))))
    else:
        assert len(sys.argv) == 6 and sys.argv[1] == '--prepare', 'Provide --prepare controls canonical-source new-output node or --verify output node'
        print(json.dumps(prepare(*map(Path, sys.argv[2:]))))
