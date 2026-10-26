"""Exercise the real metadata-only Git tree builder without publishing any reference."""
from pathlib import Path
import hashlib
import json
import signal
import sys

if sys.flags.optimize:
    raise RuntimeError('Git tree qualification requires non-optimized Python')

repository = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
script = repository/'.cache/qualify-bounded-git-transport.py'
output = repository/'.cache/bounded-git-tree-final-no-hydration-qualification'
output.mkdir(exist_ok=False)
work = Path('/run/rustdom-bounded-git-tree-final-no-hydration-20261026')
work.mkdir(exist_ok=False)
namespace = {'__name__':'bounded_git_tree_local_test','__file__':str(script)}
exec(compile(script.read_bytes(),str(script),'exec'),namespace)
namespace['OUTPUT'] = output
namespace['WORK'] = work
previous = namespace['start_supervision']()
try:
    policy = namespace['POLICY']
    parent = policy['expectedInitialParent']
    clone = namespace['clone_bare']('local-tree',parent)
    with namespace['INPUT'].open('rb') as reader:
        payload = reader.read(policy['sliceBytes'])
    expected = hashlib.sha256(payload).hexdigest()
    blob = namespace['object_id'](namespace['command'](namespace['GIT']+['hash-object','-w','--stdin'],
        'input-blob',clone,payload))
    del payload
    packs_before = sorted(file.name for file in (clone/'objects/pack').glob('*.pack'))
    tree = namespace['add_metadata_tree'](clone,parent,policy['namespace']+'/slices/0000.bin',blob,'positive')
    packs_after = sorted(file.name for file in (clone/'objects/pack').glob('*.pack'))
    if packs_before != packs_after:
        raise AssertionError('Metadata builder downloaded additional parent packs')
    if (clone/'index').exists():
        raise AssertionError('Metadata-only tree builder created an index')
    original_tree = namespace['object_id'](namespace['command'](namespace['GIT']+['rev-parse',parent+'^{tree}'],'original-tree',clone))
    if tree == original_tree:
        raise AssertionError('New slice did not change the Git tree')
    try:
        namespace['add_metadata_tree'](clone,parent,'AGENTS.md',blob,'existing-file')
        raise AssertionError('Tree builder overwrote an existing file')
    except FileExistsError:
        pass
    if namespace['object_id'](namespace['command'](namespace['GIT']+['rev-parse','HEAD'],'unchanged-ref',clone)) != parent:
        raise AssertionError('Local test unexpectedly changed its branch reference')
    summary = {'transportScriptSha256':hashlib.sha256(script.read_bytes()).hexdigest(),
        'baseEvidenceCommit':parent,'newTree':tree,'sliceBytes':policy['sliceBytes'],'sliceSha256':expected,
        'onlySingleAdditionVerifiedByGitDiff':True,'existingFileOverwriteRejected':True,'indexCreated':False,
        'localRefUnchanged':True,'remoteMutationPerformed':False,'retainedLocalBareForAudit':True,
        'additionalParentPacksDownloaded':False,'initialPackFiles':packs_before,
        'DOMExecuted':False,'scientificCaptureExecuted':False}
    (output/'summary.json').write_bytes(json.dumps(summary,indent=2).encode()+b'\n')
    print(json.dumps(summary),flush=True)
finally:
    namespace['settle_tree'](terminate=True)
    for requested,handler in previous.items():
        signal.signal(requested,handler)
