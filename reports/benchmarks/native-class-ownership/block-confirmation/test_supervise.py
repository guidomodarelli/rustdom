"""Exercise the real Linux supervisor and detached processes at an owned coordinator fault boundary; no DOM, fake platform API or scientific data."""
import sys
if sys.flags.optimize:
    raise RuntimeError('Supervisor contracts require non-optimized Python')
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import tempfile
import time
import unittest
import py_compile

SOURCE = Path(__file__).resolve().parent
REPOSITORY = SOURCE.parents[3]
NODE = Path(os.environ['RUSTDOM_CONFIRMATION_NODE']).resolve(strict=True)
POLICY = json.loads((SOURCE / 'constants/capture.json').read_bytes())
DESIGN = json.loads((SOURCE / 'constants/design.json').read_bytes())
assert hashlib.sha256(NODE.read_bytes()).hexdigest() in DESIGN['nodeExecutableSha256'].values()

COORDINATOR = r"""'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const policy=require('./constants/capture.json');
const destination=process.argv[4],criterionId=process.argv[5];
fs.mkdirSync(destination);
const uptimeSeconds=Number(fs.readFileSync('/proc/uptime','ascii').split(' ',1)[0]);
fs.writeFileSync(path.join(destination,policy.files.captureStart),JSON.stringify({revision:policy.revision,mode:policy.functionalMode,
parentPid:process.pid,node:process.version,criterionId:process.env.CONFIRMATION_FAULT==='bad-marker'?'synthetic-invalid-marker':criterionId,uptimeSeconds,uptimeResolutionSeconds:policy.uptimeResolutionSeconds,
captureBudgetMs:policy.functionalTimeoutMs,clock:policy.uptimeClock}));
if(process.env.CONFIRMATION_FAULT==='success')process.exit(0);
const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});child.unref();
fs.writeFileSync(path.join(destination,'ready.json'),JSON.stringify({parentPid:process.pid,childPid:child.pid}));
if(process.env.CONFIRMATION_FAULT==='orphan')process.exit(7);
setInterval(()=>{},1000);
"""


class SupervisorContracts(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='confirmation-supervisor-contract-')
        self.root = Path(self.temporary.name)
        self.repository = self.root / 'repo'
        self.source = self.repository / SOURCE.relative_to(REPOSITORY)
        (self.source / 'constants').mkdir(parents=True)
        for name in ['supervise.py', 'constants/capture.json', 'constants/design.json']:
            shutil.copyfile(SOURCE / name, self.source / name)
        helper = self.repository / POLICY['supervisor']['helper']
        helper.parent.mkdir(parents=True)
        shutil.copyfile(REPOSITORY / POLICY['supervisor']['helper'], helper)
        original_policy = REPOSITORY / Path(POLICY['supervisor']['helper']).parent.parent / 'constants/capture.json'
        target_policy = helper.parent.parent / 'constants/capture.json'
        target_policy.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(original_policy, target_policy)
        (self.source / 'criterion.cjs').write_text(COORDINATOR)
        self.prepared = self.root / 'unused-package'; self.prepared.mkdir()
        self.output = self.root / 'criterion'; self.receipt = self.root / 'supervisor.json'

    def tearDown(self):
        self.temporary.cleanup()

    def argv(self):
        return [sys.executable, '-B', str(self.source / 'supervise.py'), '--functional', str(self.receipt),
                str(NODE), '--expose-gc', str(self.source / 'criterion.cjs'), '--functional', str(self.prepared),
                str(self.output), 'synthetic-lifecycle-boundary-no-scientific-samples']

    def run_case(self, fault):
        child = subprocess.run(self.argv(), env=dict(os.environ, CONFIRMATION_FAULT=fault), capture_output=True, timeout=30)
        record = json.loads(self.receipt.read_bytes())
        self.assertTrue(record['complete']); self.assertEqual(record['ownedDescendantsRemaining'], [])
        self.assertIsNone(record['performanceAccepted']); self.assertFalse(record['gateReevaluated'])
        return child, record

    def test_fast_success_reads_marker_even_after_the_parent_exits(self):
        child, record = self.run_case('success')
        self.assertEqual(child.returncode, 0, child.stderr.decode())
        self.assertEqual(record['parentExitCode'], 0); self.assertEqual(record['exitCode'], 0)
        self.assertIn('captureStartMarkerSha256', record)
        self.assertFalse(record['unexpectedDescendants']); self.assertFalse(record['deadlineReached'])

    def test_forced_parent_exit_reaps_a_real_detached_child_without_accepting_it(self):
        child, record = self.run_case('orphan')
        self.assertEqual(child.returncode, 2); self.assertEqual(record['parentExitCode'], 7)
        self.assertTrue(record['unexpectedDescendants'])
        self.assertTrue(record['descendantsObservedAtParentExit'])

    def test_functional_fault_fixture_deadline_kills_owned_processes_and_preserves_rejection(self):
        # Only this owned functional fixture is shortened. The scientific design/budgets are not changed.
        filename = self.source / 'constants/capture.json'; policy = json.loads(filename.read_bytes())
        policy['functionalTimeoutMs'] = 200; filename.write_text(json.dumps(policy))
        child, record = self.run_case('wait')
        self.assertEqual(child.returncode, 2); self.assertTrue(record['deadlineReached'])

    def test_real_termination_signal_closes_parent_and_detached_descendant(self):
        child = subprocess.Popen(self.argv(), env=dict(os.environ, CONFIRMATION_FAULT='wait'), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            deadline = time.monotonic() + 10
            while not (self.output / 'ready.json').exists():
                self.assertIsNone(child.poll())
                self.assertLess(time.monotonic(), deadline); time.sleep(0.02)
            child.send_signal(signal.SIGTERM)
            stdout, stderr = child.communicate(timeout=20)
            self.assertEqual(child.returncode, 2, stderr.decode())
            record = json.loads(self.receipt.read_bytes())
            self.assertTrue(record['interrupted']); self.assertEqual(record['ownedDescendantsRemaining'], [])
        finally:
            if child.poll() is None:
                child.send_signal(signal.SIGTERM); child.communicate(timeout=20)

    def test_invalid_marker_reaps_live_owned_processes_and_preserves_the_failure(self):
        child, record = self.run_case('bad-marker')
        self.assertEqual(child.returncode, 2)
        self.assertIn('failure', record); self.assertEqual(record['exitCode'], 2)

    def test_existing_receipt_is_preserved_before_launching_a_coordinator(self):
        original = b'previous-owned-or-concurrent-evidence\n'; self.receipt.write_bytes(original)
        child = subprocess.run(self.argv(), env=dict(os.environ, CONFIRMATION_FAULT='success'), capture_output=True, timeout=20)
        self.assertEqual(child.returncode, 2); self.assertEqual(self.receipt.read_bytes(), original)
        self.assertFalse(self.output.exists())

    def test_source_checked_helper_ignores_a_valid_tampered_bytecode_cache(self):
        helper = self.repository / POLICY['supervisor']['helper']
        original = helper.read_bytes(); original_stat = helper.stat()
        helper.write_bytes(b"raise RuntimeError('Tampered helper cache was executed')\n".ljust(len(original), b' '))
        os.utime(helper, ns=(original_stat.st_atime_ns, original_stat.st_mtime_ns))
        py_compile.compile(str(helper), doraise=True)
        helper.write_bytes(original); os.utime(helper, ns=(original_stat.st_atime_ns, original_stat.st_mtime_ns))
        child, record = self.run_case('success')
        self.assertEqual(child.returncode, 0, child.stderr.decode()); self.assertEqual(record['exitCode'], 0)

    def test_qualifier_ignores_supervisor_bytecode_and_rejects_unknown_sdk_before_execution(self):
        for name in ['qualify.py', 'reader_process.py']:
            shutil.copyfile(SOURCE / name, self.source / name)
        filename = self.source / 'supervise.py'; original = filename.read_bytes(); original_stat = filename.stat()
        filename.write_bytes(b"raise RuntimeError('Tampered supervisor cache was executed')\n".ljust(len(original), b' '))
        os.utime(filename, ns=(original_stat.st_atime_ns, original_stat.st_mtime_ns)); py_compile.compile(str(filename), doraise=True)
        filename.write_bytes(original); os.utime(filename, ns=(original_stat.st_atime_ns, original_stat.st_mtime_ns))
        child = subprocess.run([sys.executable, '-B', str(self.source / 'qualify.py'), '--functional',
            '/usr/bin/false', str(self.prepared), str(self.output)], capture_output=True, timeout=20)
        self.assertEqual(child.returncode, 2); self.assertIn(b'unrecognized SDK; never execute it', child.stderr)
        self.assertFalse(self.output.exists())

    def test_real_signal_after_parent_exit_cannot_be_published_as_success(self):
        wrapper = self.root / 'late-signal.py'
        wrapper.write_text("""import os,signal,sys,types
from pathlib import Path
source=Path(sys.argv[1]); module=types.ModuleType('actual_supervisor');module.__file__=str(source)
exec(compile(source.read_bytes(),str(source),'exec'),module.__dict__)
sys.exit(module.supervise('functional',Path(sys.argv[2]),sys.argv[3:],on_cleanup=lambda:os.kill(os.getpid(),signal.SIGTERM)))
""")
        argv = [sys.executable, '-B', str(wrapper), str(self.source / 'supervise.py'), str(self.receipt), *self.argv()[5:]]
        child = subprocess.run(argv, env=dict(os.environ, CONFIRMATION_FAULT='success'), capture_output=True, timeout=20)
        self.assertEqual(child.returncode, 2, child.stderr.decode())
        record = json.loads(self.receipt.read_bytes())
        self.assertEqual(record['parentExitCode'], 0); self.assertTrue(record['interrupted']); self.assertEqual(record['exitCode'], 2)
        self.assertEqual(record['ownedDescendantsRemaining'], [])

    def test_cleanup_observer_failure_cannot_skip_reaping_a_real_detached_child(self):
        wrapper = self.root / 'observer-failure.py'
        wrapper.write_text("""import sys,types
from pathlib import Path
source=Path(sys.argv[1]); module=types.ModuleType('actual_supervisor');module.__file__=str(source)
exec(compile(source.read_bytes(),str(source),'exec'),module.__dict__)
def fail():raise RuntimeError('Owned cleanup observer failed deliberately')
sys.exit(module.supervise('functional',Path(sys.argv[2]),sys.argv[3:],on_cleanup=fail))
""")
        argv = [sys.executable, '-B', str(wrapper), str(self.source / 'supervise.py'), str(self.receipt), *self.argv()[5:]]
        child = subprocess.run(argv, env=dict(os.environ, CONFIRMATION_FAULT='orphan'), capture_output=True, timeout=20)
        self.assertEqual(child.returncode, 2, child.stderr.decode())
        record = json.loads(self.receipt.read_bytes())
        self.assertIn('cleanupObserverFailure', record); self.assertEqual(record['ownedDescendantsRemaining'], [])
        detached_pid = json.loads((self.output / 'ready.json').read_bytes())['childPid']
        self.assertFalse((Path('/proc') / str(detached_pid)).exists())

    def test_real_journal_write_failure_cannot_skip_reaping_a_detached_child(self):
        wrapper = self.root / 'journal-failure.py'
        wrapper.write_text("""import sys,types
from pathlib import Path
source=Path(sys.argv[1]); receipt=Path(sys.argv[2]); module=types.ModuleType('actual_supervisor');module.__file__=str(source)
exec(compile(source.read_bytes(),str(source),'exec'),module.__dict__)
def block_journal():receipt.with_name('.'+receipt.name+'.next').mkdir()
sys.exit(module.supervise('functional',receipt,sys.argv[3:],on_cleanup=block_journal))
""")
        argv = [sys.executable, '-B', str(wrapper), str(self.source / 'supervise.py'), str(self.receipt), *self.argv()[5:]]
        child = subprocess.run(argv, env=dict(os.environ, CONFIRMATION_FAULT='orphan'), capture_output=True, timeout=20)
        self.assertNotEqual(child.returncode, 0)
        self.assertTrue(self.receipt.with_name('.' + self.receipt.name + '.next').is_dir())
        record = json.loads(self.receipt.read_bytes()); self.assertFalse(record['complete'])
        detached_pid = json.loads((self.output / 'ready.json').read_bytes())['childPid']
        self.assertFalse((Path('/proc') / str(detached_pid)).exists())


READER_COORDINATOR = r"""const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const destination=process.argv[6];fs.mkdirSync(destination);
if(process.env.CONFIRMATION_FAULT==='success')process.exit(0);
const child=spawn(process.env.CONFIRMATION_PYTHON,['-B','-c','import time;time.sleep(1000)'],{detached:true,stdio:'ignore'});child.unref();
fs.writeFileSync(path.join(destination,'ready.json'),JSON.stringify({parentPid:process.pid,childPid:child.pid}));
if(process.env.CONFIRMATION_FAULT==='orphan')process.exit(7);
setInterval(()=>{},1000);
"""


class ReaderProcessContracts(unittest.TestCase):
    def setUp(self):
        SupervisorContracts.setUp(self)
        shutil.copyfile(SOURCE / 'reader_process.py', self.source / 'reader_process.py')
        (self.source / 'replay-functional.cjs').write_text(READER_COORDINATOR)
        self.receipt = self.root / 'reader-process/command.json'
        self.wrapper = self.root / 'reader-case.py'
        self.wrapper.write_text("""import os,sys,types,json
from pathlib import Path
source=Path(sys.argv[1]); modules=[]
for name in ['supervise.py','reader_process.py']:
    filename=source/name; module=types.ModuleType(name);module.__file__=str(filename)
    exec(compile(filename.read_bytes(),str(filename),'exec'),module.__dict__);modules.append(module)
helpers=modules[0].HELPERS
record=modules[1].run_reader(sys.argv[3:],Path(sys.argv[2]),float(os.environ.get('CONFIRMATION_READER_TEST_SECONDS','10')),helpers)
sys.exit(record['exitCode'])
""")

    def tearDown(self):
        self.temporary.cleanup()

    def argv(self):
        return [sys.executable, '-B', str(self.wrapper), str(self.source), str(self.receipt.parent),
                str(NODE), str(self.source / 'replay-functional.cjs'), '--functional', str(self.prepared),
                str(self.prepared), str(self.root / 'unused-supervisor.json'), str(self.output)]

    def run_case(self, fault, timeout='10'):
        child = subprocess.run(self.argv(), env=dict(os.environ, CONFIRMATION_FAULT=fault,
            CONFIRMATION_PYTHON=sys.executable, CONFIRMATION_READER_TEST_SECONDS=timeout), capture_output=True, timeout=30)
        record = json.loads(self.receipt.read_bytes())
        self.assertTrue(record['complete']); self.assertEqual(record['ownedDescendantsRemaining'], [])
        self.assertIsNone(record['performanceAccepted']); self.assertFalse(record['gateReevaluated'])
        return child, record

    def test_real_reader_success_is_bounded_without_leaving_descendants(self):
        child, record = self.run_case('success')
        self.assertEqual(child.returncode, 0, child.stderr.decode()); self.assertEqual(record['parentExitCode'], 0)

    def test_nonfinite_or_nonpositive_reader_deadline_is_rejected_before_launch(self):
        for timeout in ['inf', 'nan', '-1', '0']:
            child = subprocess.run(self.argv(), env=dict(os.environ, CONFIRMATION_FAULT='success',
                CONFIRMATION_PYTHON=sys.executable, CONFIRMATION_READER_TEST_SECONDS=timeout), capture_output=True, timeout=20)
            self.assertNotEqual(child.returncode, 0); self.assertFalse(self.output.exists()); self.assertFalse(self.receipt.exists())

    def test_reader_failure_reaps_real_detached_python_authenticator(self):
        child, record = self.run_case('orphan')
        self.assertEqual(child.returncode, 2); self.assertEqual(record['parentExitCode'], 7)
        self.assertTrue(record['unexpectedDescendants'])

    def test_functional_reader_timeout_reaps_node_and_python_descendants(self):
        child, record = self.run_case('wait', '0.2')
        self.assertEqual(child.returncode, 2); self.assertTrue(record['deadlineReached'])

    def test_reader_termination_reaps_node_and_python_descendants(self):
        child = subprocess.Popen(self.argv(), env=dict(os.environ, CONFIRMATION_FAULT='wait',
            CONFIRMATION_PYTHON=sys.executable), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            deadline = time.monotonic() + 10
            while not (self.output / 'ready.json').exists():
                self.assertIsNone(child.poll()); self.assertLess(time.monotonic(), deadline); time.sleep(0.02)
            child.send_signal(signal.SIGTERM); stdout, stderr = child.communicate(timeout=20)
            self.assertEqual(child.returncode, 2, stderr.decode())
            record = json.loads(self.receipt.read_bytes())
            self.assertTrue(record['interrupted']); self.assertEqual(record['ownedDescendantsRemaining'], [])
        finally:
            if child.poll() is None:
                child.send_signal(signal.SIGTERM); child.communicate(timeout=20)


if __name__ == '__main__':
    unittest.main()
