"""Reject synthetic credential bytes in a real authenticated ZIP before any Git publication; no dependency mocks."""
import argparse
import hashlib
import json
from pathlib import Path
import signal
import sys


def main(arguments):
    root = arguments.root
    if sys.platform != 'linux' or sys.flags.optimize or root.resolve().parent != Path('/run') or root.exists():
        raise ValueError('Prepublication qualification requires a new ordinary Linux /run child')
    tool = Path(__file__).resolve().parents[1]
    lock_raw = (tool/'constants/coordinator-reader.lock.json').read_bytes()
    if hashlib.sha256(lock_raw).hexdigest() != '89dd18494ca723b0cd91cec8ea807e69877919ac8a7cdd2a52ce7ab502592ff6':
        raise ValueError('Reviewed prepublication code lock differs')
    lock = json.loads(lock_raw)
    loader_path = tool/'loader.py'
    raw = loader_path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != lock['loader']['sha256']:
        raise ValueError('Reviewed loader differs')
    loader = {'__name__':'prepublication_test_loader','__file__':str(loader_path)}
    exec(compile(raw,str(loader_path),'exec'),loader)
    modules = loader['load'](tool,lock['files'])
    runtime = modules['runtime']
    coordinator = modules['coordinator']
    replay = modules['replay']
    entry_path = tool/'collect.py'
    entry = {'__name__':'production_entry_contract','__file__':str(entry_path)}
    exec(compile(entry_path.read_bytes(),str(entry_path),'exec'),entry)
    root.mkdir(mode=0o700)
    runtime.configure(source=arguments.source,output=root/'journals',work=root/'work',
        branch='feature/pilot-v2-ci-evidence',namespace='reports/validation/prepublication-scan',native_cli=arguments.native_cli)
    handlers = runtime.start_supervision()
    try:
        plan = json.loads(arguments.existing_plan.read_bytes())
        record = plan['records'][0]
        if record['ordinal'] is not None or plan['runId'] != 40366685759:
            raise ValueError('Qualification requires the existing consumed v1 preflight original')
        with entry['private_credentials'](root,arguments.credential_cli):
            before = runtime.remote_head('before-ref')
            if before != arguments.parent:
                raise ValueError('Evidence branch changed before refusal test')
            invoked = []

            def reject_original(original):
                invoked.append(original)
                entry['reject_written_credential'](root,b'capture-consumption.json')

            def unexpected_inspector(extracted, original):
                raise AssertionError('Credential refusal reached extraction/replay')

            try:
                coordinator.coordinate_one(record,relative_prefix='reports/validation/prepublication-scan/parts',
                    parent=before,author=['Unused refusal author','unused@example.invalid'],ordinal=0,
                    inspect=unexpected_inspector,before_publication=reject_original)
            except RuntimeError as error:
                if str(error) != 'Credential bytes reached private evidence; publication is unsafe':
                    raise
            else:
                raise AssertionError('Synthetic credential bytes reached publication')
            after = runtime.remote_head('after-ref')
            if after != before or len(invoked) != 1:
                raise AssertionError('Prepublication refusal mutated the branch or skipped the actual callback')
        original = invoked[0]
        filename = runtime.OUTPUT/original['originalPath']
        if runtime.checksum_path(filename) != record['metadata']['digest'][7:] or filename.stat().st_size != record['metadata']['size_in_bytes']:
            raise AssertionError('Refused original was not retained intact')
        if list(runtime.WORK.iterdir()) or list(runtime.OUTPUT.glob('*publication*')) or list(runtime.OUTPUT.glob('*intent*')):
            raise AssertionError('Credential refusal started publication or extraction')
        replay.write_json(root/'summary.json',{'actualAuthenticatedArtifact':original['id'],
            'artifactBytesRetained':original['bytes'],'syntheticCredentialOnly':True,'realCredentialBytesPersisted':False,
            'actualPrepublicationCallbackInvoked':True,'remoteBranchUnchanged':before,'publicationMutations':0,
            'originalPreserved':True,'newDOMExecuted':False,'performanceAccepted':None,'gateReevaluated':False})
        print((root/'summary.json').read_text())
    finally:
        runtime.settle_tree(terminate=True)
        for requested,handler in handlers.items():
            signal.signal(requested,handler)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for name in ['root','source','native-cli','credential-cli','existing-plan']:
        parser.add_argument('--'+name,type=Path,required=True)
    parser.add_argument('--parent',required=True)
    main(parser.parse_args())
