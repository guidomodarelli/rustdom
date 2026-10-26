"""Receive native CLI bytes incrementally; enforce exact stdout and bounded stderr before writing excess."""
import json
import math
import os
from pathlib import Path
import re
import selectors
import subprocess
import time
from urllib.parse import urlsplit

import runtime


class TransferLimitExceeded(ValueError):
    """An authenticated transfer exceeded its declared byte boundary."""


def download(arguments, label, *, expected_bytes, timeout_seconds=None, allow_local_fixture=False):
    """Keep raw partial files, close owned clients and reject every incomplete or cancelled transfer.

    This function never reads the complete archive back into memory. Authentication
    of the resulting file's digest belongs to the artifact collector.
    """
    runtime.check_cancelled()
    if not runtime.CONFIGURED:
        raise RuntimeError('Evidence download requires the configured dedicated Linux runtime')
    policy = runtime.POLICY
    if type(expected_bytes) is not int or not 0 < expected_bytes <= policy['maximumArchiveBytes']:
        raise ValueError('Evidence download size is outside the declared archive bound')
    if not isinstance(label,str) or not re.fullmatch(policy['operationLabelPattern'],label):
        raise ValueError('Evidence download operation label is not canonical')
    if (not isinstance(arguments,list) or len(arguments) != 3 or not all(isinstance(argument,str) for argument in arguments)
            or arguments[1] != 'api' or Path(arguments[0]).resolve(strict=True) != runtime.NATIVE_CLI):
        raise ValueError('Evidence download must execute the authenticated native CLI')
    endpoint = arguments[2]
    if re.fullmatch(policy['artifactEndpointPattern'],endpoint):
        arguments = [str(runtime.NATIVE_CLI),'api','--hostname','github.com','--method','GET',endpoint]
    else:
        parsed = urlsplit(endpoint)
        if (allow_local_fixture is not True or parsed.scheme != 'http' or parsed.hostname != '127.0.0.1'
                or parsed.username is not None or parsed.password is not None or not parsed.port
                or parsed.query or parsed.fragment):
            raise ValueError('Evidence download endpoint is outside the artifact API or explicit local fixture')
        for name in ['GH_TOKEN','GITHUB_TOKEN','GH_ENTERPRISE_TOKEN','GITHUB_ENTERPRISE_TOKEN']:
            if os.environ.get(name) != policy['localFixtureToken']:
                raise ValueError('Local transport fixtures must not receive real credential providers')
    limit = policy['downloadTimeoutSeconds'] if timeout_seconds is None else timeout_seconds
    if type(limit) not in [int,float] or not math.isfinite(limit) or not 0 < limit <= policy['downloadTimeoutSeconds']:
        raise ValueError('Evidence download timeout is outside the declared transport bound')
    destination = runtime.OUTPUT/label
    destination.mkdir(exist_ok=False)
    stdout_path = destination/'stdout.bin'
    stderr_path = destination/'stderr.bin'
    process = None
    subtree = None
    failure = None
    timed_out = False
    received = {'stdout':0,'stderr':0}
    stored = {'stdout':0,'stderr':0}
    started = time.monotonic()
    deadline = started+limit
    selector = selectors.DefaultSelector()
    try:
        with stdout_path.open('xb',buffering=0) as stdout,stderr_path.open('xb',buffering=0) as stderr:
            try:
                process = subprocess.Popen(arguments,cwd=runtime.SOURCE,stdin=subprocess.DEVNULL,
                    stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
                writers = {'stdout':stdout,'stderr':stderr}
                limits = {'stdout':expected_bytes,'stderr':policy['maximumStderrBytes']}
                for name,pipe in [('stdout',process.stdout),('stderr',process.stderr)]:
                    os.set_blocking(pipe.fileno(),False)
                    selector.register(pipe,selectors.EVENT_READ,name)
                while selector.get_map():
                    runtime.check_cancelled()
                    remaining = deadline-time.monotonic()
                    if remaining <= 0:
                        timed_out = True
                        raise subprocess.TimeoutExpired(arguments,limit)
                    for key,events in selector.select(min(remaining,policy['terminationPollSeconds'])):
                        name = key.data
                        maximum_read = min(policy['readChunkBytes'],limits[name]-stored[name]+1)
                        try:
                            chunk = os.read(key.fileobj.fileno(),maximum_read)
                        except BlockingIOError:
                            continue
                        if not chunk:
                            selector.unregister(key.fileobj)
                            key.fileobj.close()
                            continue
                        received[name] += len(chunk)
                        writable = min(len(chunk),limits[name]-stored[name])
                        if writable:
                            written = writers[name].write(chunk[:writable])
                            if written is None:
                                written = 0
                            stored[name] += written
                            if written != writable:
                                raise OSError('Evidence transfer short write for '+label+' '+name)
                        if received[name] > limits[name]:
                            raise TransferLimitExceeded('Evidence transfer exceeded '+name+' byte bound for '+label)
                remaining = deadline-time.monotonic()
                if remaining <= 0:
                    timed_out = True
                    raise subprocess.TimeoutExpired(arguments,limit)
                try:
                    process.wait(timeout=remaining)
                except subprocess.TimeoutExpired:
                    timed_out = True
                    raise
                if process.returncode != 0:
                    raise RuntimeError('Native evidence client failed for '+label+'; raw output retained')
                if stored['stdout'] != expected_bytes:
                    raise ValueError('Evidence download is shorter than its declared size for '+label)
            except BaseException as error:
                failure = error
                subtree = runtime.settle_tree(process,terminate=True)
            finally:
                selector.close()
                if process is not None:
                    for pipe in [process.stdout,process.stderr]:
                        if pipe is not None and not pipe.closed:
                            pipe.close()
                if subtree is None:
                    try:
                        subtree = runtime.settle_tree(process)
                    except BaseException as error:
                        failure = error
                        subtree = runtime.settle_tree(process,terminate=True)
                receipt = {'pid':process.pid if process is not None else None,
                    'exitCode':process.returncode if process is not None else None,'timedOut':timed_out,
                    'errorType':type(failure).__name__ if failure is not None else None,
                    'cancelledSignal':runtime.CANCELLED_SIGNAL,'expectedStdoutBytes':expected_bytes,
                    'receivedBytes':received,'storedBytes':stored,'subtree':subtree,
                    'elapsedSeconds':time.monotonic()-started,'archiveLoadedIntoMemory':False,
                    'scientificCaptureExecuted':False}
                with (destination/'process.json').open('xb') as writer:
                    writer.write(json.dumps(receipt,indent=2).encode()+b'\n')
    finally:
        selector.close()
    # A signal deferred during timeout cleanup wins over the expected timeout.
    runtime.check_cancelled()
    if failure is not None:
        raise failure
    return {'stdout':stdout_path,'stderr':stderr_path,'receipt':destination/'process.json'}
