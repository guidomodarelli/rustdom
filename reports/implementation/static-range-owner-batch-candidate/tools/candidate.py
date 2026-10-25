"""Prepare and qualify the owner-pair candidate with pinned existing helpers; no benchmark or production integration."""
import hashlib
import json
import os
from pathlib import Path
import sys
import types

if sys.flags.optimize:
    raise RuntimeError('Owner-pair candidate tools require non-optimized Python')

POLICY = json.loads((Path(__file__).parent / 'constants/tooling.json').read_bytes())


def pinned(repository, identity):
    """Read current repository bytes after checking each independently pinned transitive configuration."""
    for dependency in identity.get('dependencies', []):
        pinned(repository, dependency)
    filename = repository / identity['path']
    content = filename.read_bytes()
    assert hashlib.sha256(content).hexdigest() == identity['sha256'], 'Owner-pair current input changed: ' + identity['path']
    return filename, content


def load(repository, identity, name):
    """Compile authenticated source bytes, avoiding filesystem module caches."""
    filename, content = pinned(repository, identity)
    module = types.ModuleType(name)
    module.__file__ = str(filename)
    exec(compile(content, str(filename), 'exec'), module.__dict__)
    return module


def context(repository):
    """Specialize existing functional preparation/qualification without editing their historical sources."""
    prepared = load(repository, POLICY['sharedModules']['prepare'], 'owner_pair_shared_prepare')
    prepared.POLICY = {**prepared.POLICY, 'revision': POLICY['revision'], 'packet': POLICY['packet'],
                       'sourceManifest': POLICY['manifest']}
    command = load(repository, POLICY['sharedModules']['command'], 'owner_pair_shared_command')
    aliases = {'prepare': prepared, 'command': command}
    previous = {name: sys.modules.get(name) for name in aliases}
    try:
        sys.modules.update(aliases)
        qualified = load(repository, POLICY['sharedModules']['qualify'], 'owner_pair_shared_qualify')
    finally:
        for name, module in previous.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module
    qualified.POLICY = {**qualified.POLICY, 'revision': POLICY['revision'],
                        'consumerInputs': [*qualified.POLICY['consumerInputs'],
                                           *[entry['target'] for entry in POLICY['extraFiles']
                                             if entry['target'].endswith(('.cts', '.mts'))]]}
    return prepared, command, qualified


def manifest(repository):
    """Use only the candidate declaration bound before preparation, not an artifact-provided identity."""
    _, content = pinned(repository, POLICY['manifest'])
    return json.loads(content)


def prepare(repository, source, output):
    """Preserve dirty inputs and apply one source-bound patch plus real consumer/behavior contracts."""
    repository, source = repository.resolve(strict=True), source.resolve(strict=True)
    prepared, _, _ = context(repository)
    declaration = manifest(repository)
    copies = []
    for entry in POLICY['extraFiles']:
        original = prepared.safe_relative(repository / POLICY['packet'], entry['source'])
        target = prepared.safe_relative(source, entry['target'])
        checksum = declaration['tests'][entry['source']]
        assert prepared.digest(original) == checksum, entry['source']
        assert not target.exists() and not target.is_symlink(), 'Owner-pair preparation: preserve ' + entry['target']
        copies.append((original, target, checksum))
    record = prepared.prepare(repository, source, output)
    try:
        record['prepared'] = False
        for original, target, checksum in copies:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(original.read_bytes())
            assert prepared.digest(target) == checksum
            record['copiedTests'][target.relative_to(source).as_posix()] = checksum
        record.update(prepared.git_snapshot(source))
        assert not record['sourceGitErrors']
        record['prepared'] = True
    except Exception as error:
        record['failure'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        record.update(prepared.git_snapshot(source))
        if record['sourceGitErrors'] or record['sourceCommit'] != declaration['baseCommit']:
            record['prepared'] = False
        (output / prepared.POLICY['preparationFile']).write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8', newline='\n')
    assert record['prepared'], 'Owner-pair preparation: final Git provenance failed'
    return record


def qualify(repository, source, proof, node):
    """Run the full existing real suites and both new typed consumers; preserve failure/partial status."""
    repository, source, proof, node = [filename.resolve(strict=True) for filename in [repository, source, proof, node]]
    prepared, command, qualified = context(repository)
    manifest(repository)
    record = qualified.qualify(repository, source, proof, node)
    record['qualified'] = False
    record['extraConsumersPending'] = True
    result_file = proof / qualified.POLICY['qualificationFile']
    result_file.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8', newline='\n')
    environment = dict(os.environ, PATH=str(node.parent) + os.pathsep + os.environ.get('PATH', ''),
                       RUSTDOM_STATIC_RANGE_SOURCE=str(source), RUSTDOM_COMBINED_SOURCE=str(source),
                       RUSTDOM_RANGE_PREPARATION_SOURCE=str(source))
    try:
        for filename in POLICY['extraConsumers']:
            result = command.run_command('owner-pair-' + filename, [node, source / qualified.POLICY['directories']['consumers'] / 'tests/consumers' / filename],
                                         source, environment, proof / qualified.POLICY['directories']['logs'],
                                         qualified.POLICY['commandTimeoutSeconds'], qualified.POLICY['cleanupTimeoutSeconds'])
            record['commands'].append(result)
            assert result['exitCode'] == 0 and not result['timedOut'], 'Owner-pair typed consumer failed: ' + filename
        record.update(prepared.git_snapshot(source))
        assert not record['sourceGitErrors'] and record['sourceCommit'] == prepared.POLICY['baseCommit']
        for relative, expected in manifest(repository)['sources'].items():
            assert prepared.digest(source / relative) == expected, relative
        assert prepared.digest(source / 'dist/rustdom.node') == record['nativeBuild']['binarySha256']
        record['extraConsumersPending'] = False
        record['qualified'] = True
    except Exception as error:
        record['failure'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        (proof / qualified.POLICY['commandsFile']).write_text(json.dumps(record['commands'], indent=2) + '\n', encoding='utf-8', newline='\n')
        result_file.write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8', newline='\n')
    return record


if __name__ == '__main__':
    assert len(sys.argv) in [5, 6], 'Provide --prepare/--qualify, repository, source, proof and Node for qualification'
    operation, repository, source, proof = sys.argv[1:5]
    if operation == POLICY['operations']['prepare']:
        assert len(sys.argv) == 5
        result = prepare(*map(Path, [repository, source, proof]))
    else:
        assert operation == POLICY['operations']['qualify'] and len(sys.argv) == 6
        result = qualify(*map(Path, [repository, source, proof, sys.argv[5]]))
    print(json.dumps(result))
