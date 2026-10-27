"""Own the real coordinator/worker subtree and bound its full capture, including forced parent exit."""
import sys
if sys.flags.optimize:
    raise RuntimeError('Confirmation supervisor requires non-optimized Python')
import ctypes
import hashlib
import types
import json
import os
from pathlib import Path
import signal
import subprocess
import time

SOURCE = Path(__file__).resolve().parent
REPOSITORY = SOURCE.parents[3]
POLICY = json.loads((SOURCE / 'constants/capture.json').read_bytes())
DESIGN = json.loads((SOURCE / 'constants/design.json').read_bytes())
HELPER_PATH = REPOSITORY / POLICY['supervisor']['helper']
HELPER_BYTES = HELPER_PATH.read_bytes()
assert hashlib.sha256(HELPER_BYTES).hexdigest() == POLICY['supervisor']['helperSha256']
HELPERS = types.ModuleType('confirmation_owned_process_helpers')
HELPERS.__file__ = str(HELPER_PATH)
exec(compile(HELPER_BYTES, str(HELPER_PATH), 'exec'), HELPERS.__dict__)


def supervise(mode, receipt_path, argv, on_cleanup=None):
    """Launch exactly the real criterion entry and reap only still-identical kernel-observed descendants."""
    assert sys.platform == 'linux' and mode in POLICY['modes']
    assert on_cleanup is None or callable(on_cleanup)
    if mode == POLICY['captureMode']:
        assert POLICY['executionReady'] and DESIGN['executionReady'], 'Confirmation supervisor: scientific method is not published'
    assert 'NODE_OPTIONS' not in os.environ
    assert len(argv) == 7 and argv[1:2] == POLICY['parentExecArgv']
    assert Path(argv[2]).resolve(strict=True) == SOURCE / 'criterion.cjs'
    assert argv[3] == (POLICY['captureOption'] if mode == POLICY['captureMode'] else POLICY['functionalOption'])
    node = Path(argv[0]).resolve(strict=True)
    checksum = hashlib.sha256(node.read_bytes()).hexdigest()
    assert checksum in DESIGN['nodeExecutableSha256'].values()
    argv = [str(node), argv[1], str(SOURCE / 'criterion.cjs'), argv[3],
            str(Path(argv[4]).resolve(strict=True)), str(Path(argv[5]).parent.resolve(strict=True) / Path(argv[5]).name), argv[6]]
    receipt_path = receipt_path.parent.resolve(strict=True) / receipt_path.name
    assert not os.path.lexists(receipt_path)
    for protected in [REPOSITORY, Path(argv[4])]:
        assert not receipt_path.is_relative_to(protected)
    started = time.monotonic(); boot_started = time.clock_gettime(time.CLOCK_BOOTTIME)
    job_started = float(os.environ[POLICY['jobStartedUptimeEnvironment']]) if mode == POLICY['captureMode'] else boot_started
    assert 0 <= job_started <= boot_started
    setup_seconds = DESIGN['setupBudgetMinutes'] * 60 if mode == POLICY['captureMode'] else POLICY['supervisor']['functionalSetupSeconds']
    setup_deadline = job_started + setup_seconds
    assert boot_started <= setup_deadline, 'Confirmation supervisor: setup budget already exhausted'
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(HELPERS.PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0) != 0:
        raise OSError(ctypes.get_errno(), 'Confirmation supervisor: cannot acquire own subtree')
    interrupted = False
    def interrupt(received, frame):
        nonlocal interrupted
        interrupted = True
    handlers = {requested: signal.signal(requested, interrupt) for requested in [signal.SIGINT, signal.SIGTERM]}
    budget_seconds = DESIGN['captureTimeoutMinutes'] * 60 if mode == POLICY['captureMode'] else POLICY['functionalTimeoutMs'] / 1000
    job_deadline = job_started + (DESIGN['jobTimeoutMinutes'] - DESIGN['archiveBudgetMinutes'] - DESIGN['uploadBudgetMinutes'] - DESIGN['jobMarginMinutes']) * 60 if mode == POLICY['captureMode'] else None
    record = dict(revision=POLICY['revision'], mode=mode, complete=False, supervisorPid=os.getpid(), nodeExecutableSha256=checksum,
                  argv=argv, startedUptimeSeconds=boot_started, jobStartedUptimeSeconds=job_started,
                  setupDeadlineUptimeSeconds=setup_deadline, deadlineSeconds=budget_seconds,
                  deadlineReached=False, interrupted=False, unexpectedDescendants=False,
                  performanceAccepted=None, gateReevaluated=False)
    acquired = False
    def save():
        nonlocal acquired
        pending = receipt_path.with_name('.' + receipt_path.name + '.next')
        with pending.open('xb') as output:
            output.write((json.dumps(record, indent=2) + '\n').encode())
        if acquired:
            pending.replace(receipt_path)
        else:
            HELPERS.publish_initial(pending, receipt_path); acquired = True
    child = None; capture_deadline = None; stopping_at = None
    try:
        save()
        environment = dict(os.environ, **{POLICY['supervisorPidEnvironment']: str(os.getpid())})
        child = subprocess.Popen(argv, start_new_session=True, env=environment)
        record['parentPid'] = child.pid; save()
        marker_path = Path(argv[5]) / POLICY['files']['captureStart']
        while True:
            now = time.monotonic(); boot_now = time.clock_gettime(time.CLOCK_BOOTTIME)
            marker_pending = marker_path.with_name('.' + marker_path.name + '.next')
            if capture_deadline is None and marker_path.exists() and not os.path.lexists(marker_pending):
                status = marker_path.lstat()
                assert marker_path.is_file() and not marker_path.is_symlink() and status.st_nlink == 1 and status.st_size < POLICY['supervisor']['maximumMarkerBytes']
                raw = marker_path.read_bytes(); marker = json.loads(raw)
                assert marker['revision'] == POLICY['revision'] and marker['mode'] == mode
                assert marker['parentPid'] == child.pid and marker['criterionId'] == argv[6]
                assert marker['clock'] == POLICY['uptimeClock'] and marker['uptimeResolutionSeconds'] == POLICY['uptimeResolutionSeconds']
                assert marker['captureBudgetMs'] == budget_seconds * 1000
                assert boot_started <= marker['uptimeSeconds'] + POLICY['uptimeResolutionSeconds'] <= boot_now + POLICY['uptimeResolutionSeconds']
                assert marker['uptimeSeconds'] <= setup_deadline
                capture_deadline = marker['uptimeSeconds'] + POLICY['uptimeResolutionSeconds'] + budget_seconds
                if job_deadline is not None:
                    capture_deadline = min(capture_deadline, job_deadline)
                record.update(captureStartMarkerSha256=hashlib.sha256(raw).hexdigest(), captureDeadlineUptimeSeconds=capture_deadline,
                              captureStartedUptimeSeconds=marker['uptimeSeconds'])
                save()
            deadline_reached = boot_now >= (capture_deadline if capture_deadline is not None else setup_deadline)
            record['interrupted'] = bool(interrupted); record['deadlineReached'] = deadline_reached
            if child.poll() is not None:
                break
            if interrupted or deadline_reached:
                owned = HELPERS.owned_descendants(HELPERS.processes())
                if stopping_at is None:
                    stopping_at = now; HELPERS.send_owned_signal(owned, signal.SIGTERM)
                elif now - stopping_at >= POLICY['supervisor']['terminationGraceSeconds']:
                    HELPERS.send_owned_signal(owned, signal.SIGKILL)
            time.sleep(POLICY['supervisor']['pollSeconds'])
        record['parentExitCode'] = child.wait()
    except BaseException as error:
        record['failure'] = dict(name=type(error).__name__, message=str(error))
        raise
    finally:
        try:
            record['cleanupStarted'] = True
            if on_cleanup is not None:
                try:
                    on_cleanup()
                except BaseException as observer_error:
                    record['cleanupObserverFailure'] = dict(name=type(observer_error).__name__, message=str(observer_error))
            remaining = HELPERS.owned_descendants(HELPERS.processes())
            record['descendantsObservedAtParentExit'] = remaining
            active = [entry for entry in remaining if entry['state'] not in ['Z', 'X']]
            record['unexpectedDescendants'] = bool(active)
            if active:
                HELPERS.send_owned_signal(active, signal.SIGKILL)
            if child is not None and 'parentExitCode' not in record:
                record['parentExitCode'] = child.wait(timeout=POLICY['supervisor']['reapTimeoutSeconds'])
            deadline = time.monotonic() + POLICY['supervisor']['reapTimeoutSeconds']
            while True:
                try:
                    while os.waitpid(-1, os.WNOHANG)[0] > 0:
                        pass
                except ChildProcessError:
                    pass
                remaining = HELPERS.owned_descendants(HELPERS.processes())
                record['ownedDescendantsRemaining'] = remaining
                if not remaining:
                    break
                assert time.monotonic() < deadline, 'Confirmation supervisor: owned descendants remained after cleanup'
                HELPERS.send_owned_signal(remaining, signal.SIGKILL)
                time.sleep(POLICY['supervisor']['pollSeconds'])
        except BaseException as cleanup_error:
            record['cleanupFailure'] = dict(name=type(cleanup_error).__name__, message=str(cleanup_error))
        finally:
            record['elapsedSeconds'] = time.monotonic() - started
            record['finishedUptimeSeconds'] = time.clock_gettime(time.CLOCK_BOOTTIME)
            if capture_deadline is not None and record['finishedUptimeSeconds'] > capture_deadline:
                record['deadlineReached'] = True
            record['complete'] = 'cleanupFailure' not in record
            record['interrupted'] = bool(interrupted)
            record['exitCode'] = 0 if (record['complete'] and record.get('parentExitCode') == 0 and 'failure' not in record and 'cleanupObserverFailure' not in record and 'captureStartMarkerSha256' in record and not record['deadlineReached'] and not record['interrupted'] and not record['unexpectedDescendants']) else 2
            try:
                if acquired:
                    save()
            finally:
                for requested, handler in handlers.items():
                    signal.signal(requested, handler)
    return record['exitCode']


if __name__ == '__main__':
    try:
        assert len(sys.argv) == 10, 'Provide mode, new supervisor receipt and the exact seven producer arguments'
        assert sys.argv[1] in [POLICY['functionalOption'], POLICY['captureOption']]
        sys.exit(supervise(POLICY['functionalMode'] if sys.argv[1] == POLICY['functionalOption'] else POLICY['captureMode'], Path(sys.argv[2]), sys.argv[3:]))
    except Exception as error:
        print(json.dumps(dict(operation='Confirmation supervisor', name=type(error).__name__, message=str(error))), file=sys.stderr)
        sys.exit(2)
