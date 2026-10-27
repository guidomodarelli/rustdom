"""Own and reap the complete offline reader/authenticator subtree, including timeout and termination."""
import ctypes
import hashlib
import json
import math
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
if sys.flags.optimize:
    raise RuntimeError('Confirmation reader process requires non-optimized Python')
SOURCE = Path(__file__).resolve().parent
REPOSITORY = SOURCE.parents[3]
POLICY = json.loads((SOURCE / 'constants/capture.json').read_bytes())
DESIGN = json.loads((SOURCE / 'constants/design.json').read_bytes())


def run_reader(argv, directory, timeout_seconds, helpers):
    """Bound one actual reader plus all adopted descendants; never use archived PIDs or accept performance."""
    assert sys.platform == 'linux' and len(argv) == 7
    assert math.isfinite(timeout_seconds) and 0 < timeout_seconds <= POLICY['functionalQualification']['readerTimeoutSeconds']
    assert Path(argv[1]).resolve(strict=True) == SOURCE / 'replay-functional.cjs'
    assert argv[2] == POLICY['functionalOption'] and 'NODE_OPTIONS' not in os.environ
    assert hashlib.sha256(Path(argv[0]).read_bytes()).hexdigest() in DESIGN['nodeExecutableSha256'].values()
    directory = directory.parent.resolve(strict=True) / directory.name
    for protected in [REPOSITORY, Path(argv[3]).resolve(strict=True), Path(argv[4]).resolve(strict=True)]:
        assert not directory.is_relative_to(protected) and not protected.is_relative_to(directory)
    directory.mkdir()
    receipt = directory / 'command.json'
    started = time.monotonic(); deadline = started + timeout_seconds
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(helpers.PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0) != 0:
        raise OSError(ctypes.get_errno(), 'Confirmation reader: cannot acquire own subtree')
    interrupted = False
    def interrupt(received, frame):
        nonlocal interrupted
        interrupted = True
    handlers = {requested: signal.signal(requested, interrupt) for requested in [signal.SIGINT, signal.SIGTERM]}
    record = dict(argv=argv, complete=False, readerPid=None, parentExitCode=None, deadlineReached=False,
                  interrupted=False, unexpectedDescendants=False, performanceAccepted=None, gateReevaluated=False)
    acquired = False
    def save():
        nonlocal acquired
        pending = receipt.with_name('.' + receipt.name + '.next')
        with pending.open('x') as output:
            output.write(json.dumps(record, indent=2)+'\n')
        if acquired:
            pending.replace(receipt)
        else:
            helpers.publish_initial(pending, receipt); acquired = True
    child = None
    try:
        save()
        with (directory / 'stdout.log').open('xb') as stdout, (directory / 'stderr.log').open('xb') as stderr:
            child = subprocess.Popen(argv, cwd=REPOSITORY, stdout=stdout, stderr=stderr, start_new_session=True)
            record['readerPid'] = child.pid; save()
            stopping_at = None
            while child.poll() is None:
                now = time.monotonic()
                record['deadlineReached'] = now >= deadline
                if interrupted or record['deadlineReached']:
                    owned = helpers.owned_descendants(helpers.processes())
                    if stopping_at is None:
                        stopping_at = now; helpers.send_owned_signal(owned, signal.SIGTERM)
                    elif now - stopping_at >= POLICY['supervisor']['terminationGraceSeconds']:
                        helpers.send_owned_signal(owned, signal.SIGKILL)
                time.sleep(POLICY['supervisor']['pollSeconds'])
            record['parentExitCode'] = child.wait()
    except BaseException as error:
        record['failure'] = dict(name=type(error).__name__, message=str(error))
    finally:
        try:
            remaining = helpers.owned_descendants(helpers.processes())
            active = [entry for entry in remaining if entry['state'] not in ['Z', 'X']]
            record['descendantsObservedAtReaderExit'] = remaining
            record['unexpectedDescendants'] = bool(active)
            if active:
                helpers.send_owned_signal(active, signal.SIGKILL)
            if child is not None and record['parentExitCode'] is None:
                record['parentExitCode'] = child.wait(timeout=POLICY['supervisor']['reapTimeoutSeconds'])
            reap_deadline = time.monotonic() + POLICY['supervisor']['reapTimeoutSeconds']
            while True:
                try:
                    while os.waitpid(-1, os.WNOHANG)[0] > 0:
                        pass
                except ChildProcessError:
                    pass
                remaining = helpers.owned_descendants(helpers.processes())
                record['ownedDescendantsRemaining'] = remaining
                if not remaining:
                    break
                assert time.monotonic() < reap_deadline, 'Confirmation reader: owned descendants remained after cleanup'
                helpers.send_owned_signal(remaining, signal.SIGKILL)
                time.sleep(POLICY['supervisor']['pollSeconds'])
        except BaseException as cleanup_error:
            record['cleanupFailure'] = dict(name=type(cleanup_error).__name__, message=str(cleanup_error))
        finally:
            record['elapsedSeconds'] = time.monotonic() - started
            record['deadlineReached'] = record['deadlineReached'] or time.monotonic() >= deadline
            record['interrupted'] = bool(interrupted)
            record['complete'] = 'cleanupFailure' not in record
            record['exitCode'] = 0 if (record['complete'] and record['parentExitCode'] == 0 and 'failure' not in record and
                not record['deadlineReached'] and not record['interrupted'] and not record['unexpectedDescendants']) else 2
            try:
                if acquired:
                    save()
            finally:
                for requested, handler in handlers.items():
                    signal.signal(requested, handler)
    return record
