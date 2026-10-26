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
    for case in ['controller-cancel', 'parent-hard-exit', 'parent-hard-exit-zombie']:
        root = output / case; root.mkdir()
        receipt = root / 'supervisor.json'; raw = root / 'raw'
        command = [sys.executable, '-B', str(SOURCE / 'supervise.py'), '--functional', str(receipt),
                   str(node), '--expose-gc', str(SOURCE / 'run.cjs'), '--functional', str(package), str(raw),
                   version + '/AB/jsdom/mutation-records-collect/100']
        with (root / 'stdout.log').open('xb') as stdout, (root / 'stderr.log').open('xb') as stderr:
            controller = subprocess.Popen(command, stdout=stdout, stderr=stderr)
            stopped_parent = None
            try:
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
                parent_identity = table[journal['parentPid']]
                assert parent_identity['parentPid'] == controller.pid
                (root / 'signal-observation.json').write_bytes(json.dumps({'parent': parent_identity, 'activeChildren': active}, indent=2).encode() + b'\n')
                if case == 'parent-hard-exit-zombie':
                    # Stop only the real owned parent so its real worker can exit without being reaped by Node.
                    os.kill(parent_identity['pid'], signal.SIGSTOP)
                    stopped_parent = parent_identity
                    while True:
                        table = observations.processes()
                        actual_parent = table.get(parent_identity['pid'])
                        assert actual_parent and actual_parent['startTicks'] == parent_identity['startTicks']
                        zombies = [identity for identity in table.values() if identity['parentPid'] == parent_identity['pid'] and identity['state'] == 'Z']
                        if actual_parent['state'] == 'T' and zombies:
                            break
                        assert controller.poll() is None and time.monotonic() < deadline, 'Pilot lifecycle: no real zombie child observed under stopped parent'
                        time.sleep(observations.POLICY['supervisorPollSeconds'])
                    (root / 'zombie-observation.json').write_bytes(json.dumps({'parent': actual_parent, 'zombies': zombies}, indent=2).encode() + b'\n')
                victim = controller.pid if case == 'controller-cancel' else journal['parentPid']
                os.kill(victim, signal.SIGTERM if case == 'controller-cancel' else signal.SIGKILL)
                code = controller.wait(timeout=30)
            finally:
                if controller.poll() is None:
                    if stopped_parent:
                        actual_parent = observations.processes().get(stopped_parent['pid'])
                        if actual_parent and actual_parent['startTicks'] == stopped_parent['startTicks']:
                            os.kill(stopped_parent['pid'], signal.SIGCONT)
                    controller.send_signal(signal.SIGTERM)
                    controller.wait(timeout=30)
        final = json.loads(receipt.read_bytes()); partial = json.loads((raw / 'index.json').read_bytes())
        assert code == 2 and final['complete'] and final['exitCode'] == 2
        assert final['ownedDescendantsRemaining'] == [] and not partial['complete']
        assert final['interrupted'] if case == 'controller-cancel' else not final['interrupted']
        assert final['parentExitCode'] != 0 if case == 'controller-cancel' else final['parentExitCode'] == -signal.SIGKILL
        # A worker can already be a zombie at the parent's exit. The subreaper must reap it,
        # without misreporting it as a live unexpected descendant or weakening the zero-remaining contract.
        if case == 'parent-hard-exit-zombie':
            assert final['unexpectedDescendants'] is False
            assert any(identity['pid'] in {zombie['pid'] for zombie in zombies} and identity['state'] == 'Z'
                       for identity in final['descendantsObservedAtParentExit'])
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
