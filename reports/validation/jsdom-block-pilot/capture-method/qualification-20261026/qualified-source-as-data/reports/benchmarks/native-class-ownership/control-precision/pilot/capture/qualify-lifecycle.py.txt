"""Exercise the real coordinator and sealed jsdom package under controller cancellation and forced Node death."""
import sys
if sys.flags.optimize:
    raise RuntimeError('Pilot lifecycle qualification requires non-optimized Python')
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import time

SOURCE = Path(__file__).resolve().parent
specification = importlib.util.spec_from_file_location('current_pilot_supervisor_observations', SOURCE / 'supervise.py')
observations = importlib.util.module_from_spec(specification)
specification.loader.exec_module(observations)


def read_if_complete(filename):
    try:
        return json.loads(filename.read_bytes())
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def qualify(node, package, output):
    assert sys.platform == 'linux'
    node = node.resolve(strict=True); package = package.resolve(strict=True)
    assert not os.path.lexists(output); output.mkdir()
    version = subprocess.check_output([str(node), '--version']).decode().strip()
    assert version in observations.POLICY['nodeExecutables']
    records = []
    for case in ['controller-cancel', 'parent-hard-exit']:
        root = output / case; root.mkdir()
        receipt = root / 'supervisor.json'; raw = root / 'raw'
        command = [sys.executable, '-B', str(SOURCE / 'supervise.py'), '--functional', str(receipt),
                   str(node), '--expose-gc', str(SOURCE / 'run.cjs'), '--functional', str(package), str(raw),
                   version + '/AB/jsdom/mutation-records-collect/100']
        with (root / 'stdout.log').open('xb') as stdout, (root / 'stderr.log').open('xb') as stderr:
            controller = subprocess.Popen(command, stdout=stdout, stderr=stderr)
            deadline = time.monotonic() + 120
            while True:
                journal = read_if_complete(receipt)
                index = read_if_complete(raw / 'index.json')
                table = observations.processes()
                if journal and index and any(entry['complete'] for entry in index['processes']):
                    active = [identity for identity in table.values() if identity['parentPid'] == journal['parentPid'] and identity['state'] not in ['Z', 'X']]
                    if active:
                        break
                assert controller.poll() is None and time.monotonic() < deadline, 'Pilot lifecycle: no completed work plus active owned worker observed'
                time.sleep(observations.POLICY['supervisorPollSeconds'])
            assert table[journal['parentPid']]['parentPid'] == controller.pid
            victim = controller.pid if case == 'controller-cancel' else journal['parentPid']
            os.kill(victim, signal.SIGTERM if case == 'controller-cancel' else signal.SIGKILL)
            code = controller.wait(timeout=30)
        final = json.loads(receipt.read_bytes()); partial = json.loads((raw / 'index.json').read_bytes())
        assert code == 2 and final['complete'] and final['exitCode'] == 2
        assert final['ownedDescendantsRemaining'] == [] and not partial['complete']
        assert final['interrupted'] if case == 'controller-cancel' else final['unexpectedDescendants']
        assert final['parentExitCode'] == -signal.SIGKILL if case == 'parent-hard-exit' else final['parentExitCode'] != 0
        assert 0 < sum(entry['complete'] for entry in partial['processes']) < 32
        remaining = observations.processes()
        for identity in active:
            assert identity['pid'] not in remaining or remaining[identity['pid']]['startTicks'] != identity['startTicks']
        record = {'case': case, 'node': version, 'controllerPid': controller.pid, 'parentPid': journal['parentPid'],
                  'activeChildrenObserved': active, 'activeChildrenRemaining': 0,
                  'completedWorkers': sum(entry['complete'] for entry in partial['processes']),
                  'partialPreserved': True, 'scientificCaptureExecuted': False,
                  'performanceAccepted': None, 'gateReevaluated': False}
        records.append(record)
        (output / 'outcomes.json').write_bytes(json.dumps(records, indent=2).encode() + b'\n')
        print(json.dumps(record), flush=True)
    return records


if __name__ == '__main__':
    assert len(sys.argv) == 4, 'Provide actual Node, sealed package, and new output directory'
    qualify(*map(Path, sys.argv[1:]))
