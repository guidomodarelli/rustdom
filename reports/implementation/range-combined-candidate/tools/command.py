"""Execute one qualification command with raw logs and bounded cleanup of its process group."""
import os
import json
import signal
import subprocess
import time


def run_command(label, argv, source, environment, logs, timeout_seconds, cleanup_seconds):
    """Preserve exit/timeout diagnostics and terminate owned child processes at the deadline."""
    for suffix in ['stdout.log', 'stderr.log', 'command.json']:
        if (logs / (label + '.' + suffix)).exists():
            raise FileExistsError('Combined command: preserve existing ' + label + '.' + suffix)
    before = time.monotonic()
    options = {'start_new_session': True} if os.name != 'nt' else {
        'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW}
    command = {'label': label, 'argv': list(map(str, argv)), 'exitCode': None,
               'timedOut': False, 'processGroupTerminationAttempted': False}
    try:
        with (logs / (label + '.stdout.log')).open('xb') as stdout, (logs / (label + '.stderr.log')).open('xb') as stderr:
            process = subprocess.Popen(command['argv'], cwd=source, env=environment,
                                       stdout=stdout, stderr=stderr, **options)
            command['pid'] = process.pid
            try:
                command['exitCode'] = process.wait(timeout=timeout_seconds)
            except subprocess.TimeoutExpired:
                command['timedOut'] = True
                command['processGroupTerminationAttempted'] = True
                if os.name == 'nt':
                    cleanup = subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                                             capture_output=True, timeout=cleanup_seconds,
                                             creationflags=subprocess.CREATE_NO_WINDOW)
                    (logs / (label + '.cleanup.stdout.log')).write_bytes(cleanup.stdout)
                    (logs / (label + '.cleanup.stderr.log')).write_bytes(cleanup.stderr)
                    command['cleanupExitCode'] = cleanup.returncode
                else:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                        command['cleanupExitCode'] = 0
                    except ProcessLookupError:
                        command['cleanupExitCode'] = None
                        command['processAlreadyExitedAtCleanup'] = True
                command['exitCode'] = process.wait(timeout=cleanup_seconds)
    except Exception as error:
        command['failure'] = {'type': type(error).__name__, 'message': str(error)}
        raise
    finally:
        command['seconds'] = time.monotonic() - before
        with (logs / (label + '.command.json')).open('x', encoding='utf-8', newline='\n') as receipt:
            receipt.write(json.dumps(command, indent=2) + '\n')
    return command
