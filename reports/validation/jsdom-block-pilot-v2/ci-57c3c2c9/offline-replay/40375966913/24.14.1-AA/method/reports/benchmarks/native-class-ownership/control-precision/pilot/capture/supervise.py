"""Own the real producer subtree, including detached workers orphaned by a forced parent exit."""
import sys
if sys.flags.optimize:
    raise RuntimeError('Pilot supervisor requires non-optimized Python')
import ctypes
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

SOURCE = Path(__file__).resolve().parent
POLICY = json.loads((SOURCE.parent / 'constants/capture.json').read_bytes())
PR_SET_CHILD_SUBREAPER = 36


def publish_initial(pending, destination):
    """Acquire the evidence path atomically before launching a producer; preserve a concurrent destination."""
    os.link(pending, destination)
    pending.unlink()


def processes():
    """Read only identity fields; no environment, command lines or secrets enter the journal."""
    result = {}
    for member in Path('/proc').iterdir():
        if not member.name.isdecimal():
            continue
        try:
            raw = (member / 'stat').read_text()
        except (FileNotFoundError, ProcessLookupError):
            continue
        fields = raw[raw.rfind(')') + 2:].split()
        result[int(member.name)] = {'pid': int(member.name), 'state': fields[0], 'parentPid': int(fields[1]),
                                   'group': int(fields[2]), 'startTicks': int(fields[19])}
    return result


def owned_descendants(table):
    owned = {os.getpid()}
    while True:
        expanded = owned | {pid for pid, identity in table.items() if identity['parentPid'] in owned}
        if expanded == owned:
            return [identity for pid, identity in table.items() if pid in owned and pid != os.getpid()]
        owned = expanded


def send_owned_signal(identities, requested_signal):
    """Signal only still-identical live descendants, never PIDs borrowed from archived files or stale metadata."""
    current = processes()
    for identity in identities:
        actual = current.get(identity['pid'])
        if actual is None or actual['startTicks'] != identity['startTicks']:
            continue
        try:
            os.kill(identity['pid'], requested_signal)
        except ProcessLookupError:
            pass


def supervise(mode, receipt_path, argv):
    assert sys.platform == 'linux' and mode in POLICY['modes']
    if mode == POLICY['captureMode']:
        assert POLICY['executionReady'] is True, 'Pilot supervisor: scientific method is not published'
    assert 'NODE_OPTIONS' not in os.environ
    assert len(argv) == 7 and argv[1] == '--expose-gc' and Path(argv[2]).resolve(strict=True) == SOURCE / 'run.cjs'
    assert argv[3] == (POLICY['captureOption'] if mode == POLICY['captureMode'] else POLICY['functionalOption'])
    node = Path(argv[0]).resolve(strict=True)
    checksum = hashlib.sha256(node.read_bytes()).hexdigest()
    assert checksum in POLICY['nodeExecutables'].values()
    argv[0] = str(node); argv[2] = str(SOURCE / 'run.cjs')
    argv[4] = str(Path(argv[4]).resolve(strict=True))
    argv[5] = str(Path(argv[5]).parent.resolve(strict=True) / Path(argv[5]).name)
    receipt_path = receipt_path.parent.resolve(strict=True) / receipt_path.name
    assert not os.path.lexists(receipt_path)
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0) != 0:
        raise OSError(ctypes.get_errno(), 'Pilot supervisor: cannot acquire Linux child-subreaper ownership')
    interrupted = False
    def mark_interrupted(received, frame):
        nonlocal interrupted
        interrupted = True
    previous_handlers = {}
    for requested_signal in [signal.SIGTERM, signal.SIGINT]:
        previous_handlers[requested_signal] = signal.signal(requested_signal, mark_interrupted)
    started = time.monotonic()
    boot_started = time.clock_gettime(time.CLOCK_BOOTTIME)
    job_started = float(os.environ[POLICY['jobStartedUptimeEnvironment']]) if mode == POLICY['captureMode'] else boot_started
    assert 0 <= job_started <= boot_started
    setup_deadline = job_started + POLICY['setupBudgetMinutes'] * 60
    assert boot_started <= setup_deadline, 'Pilot supervisor: job setup budget already exhausted'
    budget_seconds = (POLICY['captureTimeoutMinutes'] if mode == POLICY['captureMode'] else POLICY['functionalTimeoutMinutes']) * 60
    record = {'revision': POLICY['revision'], 'mode': mode, 'complete': False, 'supervisorPid': os.getpid(),
              'nodeExecutableSha256': checksum, 'argv': argv, 'deadlineSeconds': budget_seconds,
              'startedUptimeSeconds': boot_started,
              'jobStartedUptimeSeconds': job_started, 'setupDeadlineUptimeSeconds': setup_deadline,
              'deadlineReached': False, 'interrupted': False, 'unexpectedDescendants': False,
              'performanceAccepted': None, 'gateReevaluated': False}

    acquired = False
    def save():
        nonlocal acquired
        pending = receipt_path.with_name('.' + receipt_path.name + '.next')
        with pending.open('xb') as stream:
            stream.write((json.dumps(record, indent=2) + '\n').encode())
        if not acquired:
            publish_initial(pending, receipt_path)
            acquired = True
        else:
            pending.replace(receipt_path)

    child = None
    try:
        save()
        child = subprocess.Popen(argv, start_new_session=True)
        record['parentPid'] = child.pid; save()
        stopping_at = None
        capture_deadline = None
        start_marker_path = Path(argv[5]) / POLICY['captureStartFile']
        while child.poll() is None:
            now = time.monotonic()
            boot_now = time.clock_gettime(time.CLOCK_BOOTTIME)
            marker_pending = start_marker_path.with_name('.' + start_marker_path.name + '.next')
            if capture_deadline is None and start_marker_path.exists() and not os.path.lexists(marker_pending):
                marker_status = start_marker_path.lstat()
                assert not start_marker_path.is_symlink() and marker_status.st_nlink == 1 and marker_status.st_size <= POLICY['maximumJSONBytes']
                marker_raw = start_marker_path.read_bytes()
                marker = json.loads(marker_raw)
                assert marker['revision'] == POLICY['revision'] and marker['mode'] == mode
                assert marker['parentPid'] == child.pid and marker['criterionId'] == argv[6]
                assert marker['clock'] == POLICY['uptimeClock'] and marker['uptimeResolutionSeconds'] == POLICY['uptimeResolutionSeconds']
                assert marker['captureBudgetMs'] == budget_seconds * 1000
                assert boot_started <= marker['uptimeSeconds'] + POLICY['uptimeResolutionSeconds'] <= boot_now + POLICY['uptimeResolutionSeconds']
                assert marker['uptimeSeconds'] <= setup_deadline, 'Pilot supervisor: producer setup exceeded the separate job setup budget'
                # /proc/uptime is quantized downward. Its upper edge grants the coordinator its entire declared interval.
                capture_deadline = marker['uptimeSeconds'] + POLICY['uptimeResolutionSeconds'] + budget_seconds
                record['captureStartMarkerSha256'] = hashlib.sha256(marker_raw).hexdigest()
                record['captureDeadlineUptimeSeconds'] = capture_deadline
                record['captureStartedUptimeSeconds'] = marker['uptimeSeconds']; save()
            deadline_reached = boot_now >= (capture_deadline if capture_deadline is not None else setup_deadline)
            if interrupted or deadline_reached:
                record['interrupted'] = bool(interrupted); record['deadlineReached'] = deadline_reached
                owned = owned_descendants(processes())
                if stopping_at is None:
                    stopping_at = now
                    send_owned_signal(owned, signal.SIGTERM)
                elif now - stopping_at >= POLICY['supervisorTerminationGraceSeconds']:
                    send_owned_signal(owned, signal.SIGKILL)
            time.sleep(POLICY['supervisorPollSeconds'])
        record['parentExitCode'] = child.wait()
    finally:
        # The subreaper adopts detached workers even if Node was killed before its AbortController could run.
        remaining = owned_descendants(processes())
        record['descendantsObservedAtParentExit'] = remaining
        active = [identity for identity in remaining if identity['state'] not in ['Z', 'X']]
        record['unexpectedDescendants'] = bool(active)
        if active:
            send_owned_signal(active, signal.SIGKILL)
        deadline = time.monotonic() + POLICY['supervisorReapTimeoutSeconds']
        while True:
            try:
                while os.waitpid(-1, os.WNOHANG)[0] > 0:
                    pass
            except ChildProcessError:
                pass
            remaining = owned_descendants(processes())
            if not remaining:
                break
            assert time.monotonic() < deadline, 'Pilot supervisor: owned descendants remained after forced cleanup'
            send_owned_signal(remaining, signal.SIGKILL)
            time.sleep(POLICY['supervisorPollSeconds'])
        record['ownedDescendantsRemaining'] = remaining
        record['elapsedSeconds'] = time.monotonic() - started
        record['complete'] = True
        record['exitCode'] = 0 if (record.get('parentExitCode') == 0 and 'captureStartMarkerSha256' in record and not record['deadlineReached'] and
            not record['interrupted'] and not record['unexpectedDescendants']) else 2
        if acquired:
            save()
        for requested_signal, handler in previous_handlers.items():
            signal.signal(requested_signal, handler)
    return record['exitCode']


if __name__ == '__main__':
    try:
        assert len(sys.argv) == 10, 'Provide --functional/--capture, new supervisor receipt, and the exact seven producer argv entries'
        assert sys.argv[1] in [POLICY['functionalOption'], POLICY['captureOption']]
        sys.exit(supervise(POLICY['functionalMode'] if sys.argv[1] == POLICY['functionalOption'] else POLICY['captureMode'], Path(sys.argv[2]), sys.argv[3:]))
    except Exception as error:
        print(json.dumps({'operation': 'Pilot supervisor', 'name': type(error).__name__, 'message': str(error)}), file=sys.stderr)
        sys.exit(2)
