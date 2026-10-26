"""Catchable termination must release the actual detached reader and descendant in both SDKs; no DOM, SDK mock or fabricated measurement."""
import json
import os
import signal
import subprocess
import sys
import time
import unittest
from pathlib import Path

source = Path(__file__).resolve().parent
node = Path(os.environ['RUSTDOM_OWNER_BATCH_EXPORT_NODE']).resolve(strict=True)
root = Path(os.environ['RUSTDOM_OWNER_BATCH_CANCELLATION_OUTPUT'])
assert not root.exists()
root.mkdir()


def process_state(pid):
    try:
        raw = Path('/proc', str(pid), 'stat').read_text()
        return raw[raw.rfind(')') + 2:].split()[0]
    except FileNotFoundError:
        return None


class CancellationContracts(unittest.TestCase):
    def exercise(self, boundary, selected_signal):
        destination = root / (boundary + '-' + selected_signal.name)
        destination.mkdir()
        receipt = destination / 'real-processes.jsonl'
        args = [str(node), str(source / 'cancellation-invoker.cjs'), str(destination), str(receipt)] if boundary == 'invoker' else [
            sys.executable, '-B', str(source / 'cancellation-wrapper.py'), str(node), str(destination), str(receipt)]
        child = None
        observed = []
        try:
            with (destination / 'outer.stdout.log').open('xb') as stdout, (destination / 'outer.stderr.log').open('xb') as stderr:
                child = subprocess.Popen(args, stdout=stdout, stderr=stderr, start_new_session=True)
                deadline = time.monotonic() + 15
                while time.monotonic() < deadline:
                    if receipt.exists():
                        observed = [json.loads(line) for line in receipt.read_text().splitlines()]
                        if len(observed) == 2:
                            break
                    self.assertIsNone(child.poll(), 'Real fixture terminated before cancellation')
                    time.sleep(0.02)
                self.assertEqual({record['generation'] for record in observed}, {'parent', 'descendant'})
                self.assertTrue(all(process_state(record['pid']) not in [None, 'Z', 'X'] for record in observed))
                child.send_signal(selected_signal)
                self.assertNotEqual(child.wait(timeout=15), 0)
            invocation = json.loads((destination / 'invocation.json').read_bytes())
            self.assertTrue(invocation['cancelled']); self.assertFalse(invocation['timedOut'])
            self.assertTrue(invocation['processGroupTerminationObserved'])
            self.assertEqual(invocation['interruptedBy'], selected_signal.name)
            self.assertTrue(all(process_state(record['pid']) in [None, 'Z', 'X'] for record in observed))
            self.assertIn(b'partial output', (destination / 'decision-command/stdout.log').read_bytes())
            if boundary == 'python':
                outer = json.loads((destination / 'outer-cancellation.json').read_bytes())
                self.assertEqual(outer['interruptedBy'], selected_signal)
                self.assertNotEqual(outer['exitCode'], 0)
            (destination / 'asserted-observations.json').write_text(json.dumps({'argv': args, 'signal': selected_signal.name,
                'realProcesses': observed, 'finalStates': [process_state(record['pid']) for record in observed],
                'DOMExecuted': False, 'newBenchmarkSamples': False}, indent=2) + '\n')
        finally:
            if child is not None and child.poll() is None:
                child.send_signal(signal.SIGTERM)
                child.wait(timeout=15)
            for record in observed:
                if process_state(record['pid']) not in [None, 'Z', 'X']:
                    os.kill(record['pid'], signal.SIGKILL)

    def test_python_sigterm_propagates_and_waits(self): self.exercise('python', signal.SIGTERM)
    def test_python_sigint_propagates_and_waits(self): self.exercise('python', signal.SIGINT)
    def test_invoker_sigterm_waits_for_descendant(self): self.exercise('invoker', signal.SIGTERM)
    def test_invoker_sigint_waits_for_descendant(self): self.exercise('invoker', signal.SIGINT)


if __name__ == '__main__':
    unittest.main()
