"""Use real detached grandchildren to qualify timeout, SIGTERM and SIGINT ownership."""
from pathlib import Path
import hashlib
import json
import os
import signal
import subprocess
import sys
import time

if sys.flags.optimize or os.name != 'posix':
    raise RuntimeError('Lifecycle qualification requires non-optimized Python on Linux')

repository = Path('/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom')
script = repository/'.cache/qualify-bounded-git-transport.py'
output = repository/'.cache/bounded-git-transport-lifecycle/final-metadata-builder'
output.mkdir(parents=True,exist_ok=False)
namespace = {'__name__':'transport_lifecycle_test_helpers','__file__':str(script)}
exec(compile(script.read_bytes(),str(script),'exec'),namespace)
namespace['OUTPUT'] = output
previous_handlers = namespace['start_supervision']()
records = []
try:
    for name,mode,requested in [('timeout','timeout',None),('sigterm','signal',signal.SIGTERM),('sigint','signal',signal.SIGINT),
        ('deferred-sigterm','deferred',signal.SIGTERM),('deferred-sigint','deferred',signal.SIGINT)]:
        destination = output/name
        with (output/(name+'-orchestrator.stdout')).open('xb') as stdout, (output/(name+'-orchestrator.stderr')).open('xb') as stderr:
            process = subprocess.Popen(['python3',str(script),'--lifecycle-probe',mode,str(destination)],
                stdout=stdout,stderr=stderr,start_new_session=True)
            deadline = time.monotonic()+10
            ready = destination/'probe-command.stdout'
            while True:
                if ready.is_file():
                    try:
                        child_ids = json.loads(ready.read_bytes())
                        break
                    except json.JSONDecodeError:
                        pass
                if process.poll() is not None or time.monotonic() >= deadline:
                    raise RuntimeError('Real child/grandchild probe did not become ready: '+name)
                time.sleep(0.01)
            table = namespace['HELPERS']['processes']()
            identities = [table[child_ids['parentPid']],table[child_ids['grandchildPid']]]
            if mode == 'deferred':
                entered = destination/'cleanup-entered.json'
                while not entered.exists():
                    if process.poll() is not None or time.monotonic() >= deadline:
                        raise RuntimeError('Deferred cancellation did not reach cleanup: '+name)
                    time.sleep(0.01)
                if json.loads(entered.read_bytes())['terminating'] is not True:
                    raise AssertionError('Signal was not targeted during termination')
            if requested is not None:
                os.kill(process.pid,requested)
            process.wait(timeout=20)
            if process.returncode == 0:
                raise AssertionError('Cancellation probe unexpectedly succeeded: '+name)
        failure = json.loads((destination/'orchestrator-failure.json').read_bytes())
        if failure['subtree']['ownedDescendantsRemaining']:
            raise AssertionError('Orchestrator retained owned descendants: '+name)
        expected_type = 'TimeoutExpired' if mode == 'timeout' else 'TransportCancelled'
        if failure['type'] != expected_type or failure['cancelledSignal'] != (None if requested is None else int(requested)):
            raise AssertionError('Probe failed for an unrelated reason: '+name)
        current = namespace['HELPERS']['processes']()
        for identity in identities:
            actual = current.get(identity['pid'])
            if actual is not None and actual['startTicks'] == identity['startTicks']:
                raise AssertionError('A real child or detached grandchild remains, including zombies: '+name)
        command_receipt = json.loads((destination/'probe-command.process.json').read_bytes())
        if command_receipt['subtree']['ownedDescendantsRemaining'] or not command_receipt['directChildReaped']:
            raise AssertionError('Command receipt does not prove subtree closure: '+name)
        if mode == 'deferred' and (destination/'forbidden-after-negative.stdout').exists():
            raise AssertionError('Deferred cancellation allowed a subsequent operation')
        records.append({'case':name,'orchestratorExitCode':process.returncode,
            'realChildAndDetachedGrandchild':identities,'bothIdentitiesAbsentAfterReap':True,
            'cancelledSignal':failure['cancelledSignal'],'ownedDescendantsRemaining':[],
            'signalDuringTermination':mode == 'deferred','subsequentOperationPrevented':mode == 'deferred'})
    if namespace['owned_processes']():
        raise AssertionError('Lifecycle test controller retained descendants')
    summary = {'transportScriptSha256':hashlib.sha256(script.read_bytes()).hexdigest(),
        'cases':records,'realFailureCasesPassed':len(records),'noGitPublicationPerformed':True,
        'DOMExecuted':False,'scientificCaptureExecuted':False,'scope':'Cinco subárboles Linux finitos, con nietos desacoplados y señales durante cleanup; no prueba ausencia universal de fugas.'}
    (output/'summary.json').write_bytes(json.dumps(summary,indent=2,ensure_ascii=False).encode()+b'\n')
    print(json.dumps(summary),flush=True)
finally:
    namespace['settle_tree'](terminate=True)
    for requested,handler in previous_handlers.items():
        signal.signal(requested,handler)
