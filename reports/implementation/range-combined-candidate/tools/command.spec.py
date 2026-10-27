"""Test real command termination and raw evidence preservation, including a live descendant."""
import json
import csv
import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest

from command import run_command


class CommandContracts(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='rustdom-combined-command-')
        self.root = Path(self.directory.name).resolve()

    def tearDown(self):
        self.assertEqual(self.root.parent, Path(tempfile.gettempdir()).resolve())
        self.assertTrue(self.root.name.startswith('rustdom-combined-command-'))
        self.directory.cleanup()

    def execute(self, label, program, timeout=10):
        return run_command(label, [sys.executable, '-c', program], self.root,
                           dict(os.environ), self.root, timeout, 10)

    def test_success_preserves_raw_utf8_stdout_and_stderr(self):
        result = self.execute('success', "import sys;sys.stdout.buffer.write('árbol\\n'.encode());sys.stderr.buffer.write(b'raw error bytes\\r\\n')")
        self.assertEqual(result['exitCode'], 0)
        self.assertFalse(result['timedOut'])
        self.assertEqual((self.root / 'success.stdout.log').read_bytes(), 'árbol\n'.encode())
        self.assertEqual((self.root / 'success.stderr.log').read_bytes(), b'raw error bytes\r\n')

    def test_failure_is_returned_with_its_original_diagnostics(self):
        result = self.execute('failure', "import sys;sys.stderr.write('controlled failure');sys.exit(17)")
        self.assertEqual(result['exitCode'], 17)
        self.assertFalse(result['timedOut'])
        self.assertEqual((self.root / 'failure.stderr.log').read_bytes(), b'controlled failure')

    def test_existing_evidence_is_not_overwritten(self):
        marker = self.root / 'previous.stdout.log'; marker.write_bytes(b'preserved')
        with self.assertRaises(FileExistsError): self.execute('previous', "raise RuntimeError('must not run')")
        self.assertEqual(marker.read_bytes(), b'preserved')

    def test_startup_failure_preserves_the_attempted_command_and_error(self):
        missing = self.root / 'missing-executable'
        with self.assertRaises(FileNotFoundError):
            run_command('startup', [missing], self.root, dict(os.environ), self.root, 1, 1)
        receipt = json.loads((self.root / 'startup.command.json').read_bytes())
        self.assertEqual(receipt['argv'], [str(missing)])
        self.assertIsNone(receipt['exitCode'])
        self.assertEqual(receipt['failure']['type'], 'FileNotFoundError')
        self.assertFalse(receipt['timedOut'])

    def test_deadline_terminates_real_parent_and_descendant_processes(self):
        program = ("import subprocess,sys,time,json,os;"
                   "child=subprocess.Popen([sys.executable,'-c','import time;time.sleep(120)']);"
                   "print(json.dumps({'parent':os.getpid(),'child':child.pid}),flush=True);time.sleep(120)")
        result = self.execute('deadline', program, timeout=1)
        self.assertTrue(result['timedOut'])
        self.assertTrue(result['processGroupTerminationAttempted'])
        self.assertNotEqual(result['exitCode'], 0)
        identifiers = json.loads((self.root / 'deadline.stdout.log').read_bytes())
        self.assertEqual(identifiers['parent'], result['pid'])
        def running(pid):
            if os.name == 'nt':
                observed = subprocess.check_output(['tasklist', '/FI', 'PID eq ' + str(pid), '/FO', 'CSV', '/NH'])
                return any(len(row) > 1 and row[1] == str(pid) for row in csv.reader(io.StringIO(observed.decode(errors='replace'))))
            if os.name != 'nt':
                status = Path('/proc') / str(pid) / 'stat'
                if status.exists() and status.read_text().split()[2] == 'Z': return False
            try: os.kill(pid, 0)
            except OSError: return False
            return True
        for _ in range(30):
            if not any(running(pid) for pid in identifiers.values()): break
            time.sleep(0.1)
        self.assertFalse(any(running(pid) for pid in identifiers.values()))


if __name__ == '__main__':
    unittest.main(verbosity=2)
