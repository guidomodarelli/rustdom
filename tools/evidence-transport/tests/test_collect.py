"""Exercise the production entry point against a real wrong-source terminal run without publishing or executing DOM."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


def main(arguments):
    root = arguments.root
    if sys.platform != 'linux' or root.resolve().parent != Path('/run') or root.exists():
        raise ValueError('Collector entry qualification requires a new direct Linux /run child')
    root.mkdir(mode=0o700)
    collector = Path(__file__).resolve().parents[1]/'collect.py'
    common = ['--run','40366685759','--parent',arguments.parent,'--source',str(arguments.source),
        '--primary',str(arguments.primary),'--native-cli',str(arguments.native_cli),
        '--credential-cli',str(arguments.credential_cli)]
    cases = []

    def invoke(label, command, environment=None):
        result = subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=180,env=environment)
        (root/(label+'.stdout')).write_bytes(result.stdout)
        (root/(label+'.stderr')).write_bytes(result.stderr)
        if result.returncode == 0:
            raise AssertionError('Production collector admitted rejected case: '+label)
        cases.append({'case':label,'exitCode':result.returncode})
        return result

    optimized = root/'optimized'
    result = invoke('optimized',[sys.executable,'-O',str(collector),*common,'--root',str(optimized)])
    if optimized.exists() or b'non-optimized Linux Python' not in result.stderr:
        raise AssertionError('Optimization refusal created outputs or lost its controlled diagnostic')
    retained = root/'existing'
    retained.mkdir()
    sentinel = retained/'foreign.bin'
    sentinel.write_bytes(b'caller-owned-existing-root')
    before = hashlib.sha256(sentinel.read_bytes()).hexdigest()
    result = invoke('existing-root',[sys.executable,'-B',str(collector),*common,'--root',str(retained)])
    if hashlib.sha256(sentinel.read_bytes()).hexdigest() != before or len(list(retained.iterdir())) != 1:
        raise AssertionError('Existing root refusal changed caller-owned data')
    credential_namespace = Path('/run')/(root.name+'-namespace')
    synthetic_environment = dict(os.environ)
    synthetic_environment['GH_TOKEN'] = 'synthetic_credential_4bd'
    namespace_arguments = common[:-2]
    result = invoke('credential-namespace',[sys.executable,'-B',str(collector),*namespace_arguments,
        '--root',str(credential_namespace),'--namespace','reports/validation/synthetic_credential_4bd'],synthetic_environment)
    namespace_failure = json.loads((credential_namespace/'failure.json').read_bytes())
    if ('namespace contains credential bytes' not in namespace_failure['message']
            or (credential_namespace/'journals/pilot-run.stdout').exists()
            or namespace_failure['completedArtifacts']):
        raise AssertionError('Credential-bearing namespace reached API discovery or publication')
    rejected = Path('/run')/(root.name+'-wrong-source')
    result = invoke('wrong-source',[sys.executable,'-B',str(collector),*common,'--root',str(rejected)])
    failure = json.loads((rejected/'failure.json').read_bytes())
    if (failure['completedArtifacts'] or failure['newDOMExecuted'] is not False
            or failure['performanceAccepted'] is not None or failure['gateReevaluated'] is not False
            or 'selected terminal source/workflow/attempt' not in failure['message']):
        raise AssertionError('Real terminal v1 run was not rejected before any v2 publication')
    journals = rejected/'journals'
    if list((rejected/'work').iterdir()) or list(journals.glob('*intent*')) or list(journals.glob('zip-*')):
        raise AssertionError('Wrong-source refusal started publication or artifact reception')
    source_api = json.loads((journals/'pilot-run.stdout').read_bytes())
    if source_api['id'] != 40366685759 or source_api['head_sha'] != '1078e4fd190276a116e6dc5e64c9fe32eca3e7e9':
        raise AssertionError('Wrong-source test did not use the independently selected real historical run')
    processes = [json.loads(filename.read_bytes()) for filename in journals.glob('*.process.json')]
    if not processes or any(process.get('directChildReaped') is not True
            or process['subtree']['ownedDescendantsRemaining'] for process in processes):
        raise AssertionError('Rejected collection retained supervised descendants')
    summary = {'cases':cases,'syntheticCredentialNamespaceRefusedBeforeAPI':True,'realWrongSourceRun':40366685759,'artifactsReceived':0,
        'publicationMutations':0,'callerSentinelPreserved':True,'supervisedProcesses':len(processes),
        'newDOMExecuted':False,'performanceAccepted':None,'gateReevaluated':False}
    (root/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for name in ['root','source','primary','native-cli','credential-cli']:
        parser.add_argument('--'+name,type=Path,required=True)
    parser.add_argument('--parent',required=True)
    main(parser.parse_args())
