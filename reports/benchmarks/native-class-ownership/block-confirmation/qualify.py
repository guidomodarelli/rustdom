"""Exercise four whole functional blocks under the actual owning supervisor and independently replay every raw file."""
import sys
if sys.flags.optimize:
    raise RuntimeError('Confirmation qualification requires non-optimized Python')
import hashlib
import types
import json
import os
from pathlib import Path
import subprocess

SOURCE = Path(__file__).resolve().parent
REPOSITORY = SOURCE.parents[3]
POLICY = json.loads((SOURCE / 'constants/capture.json').read_bytes())
DESIGN = json.loads((SOURCE / 'constants/design.json').read_bytes())
QUALIFICATION = POLICY['functionalQualification']
SUPERVISOR_PATH = SOURCE / 'supervise.py'
SUPERVISOR_BYTES = SUPERVISOR_PATH.read_bytes()
SUPERVISOR = types.ModuleType('confirmation_functional_owned_supervisor')
SUPERVISOR.__file__ = str(SUPERVISOR_PATH)
exec(compile(SUPERVISOR_BYTES, str(SUPERVISOR_PATH), 'exec'), SUPERVISOR.__dict__)
READER_PATH = SOURCE / 'reader_process.py'
READER_BYTES = READER_PATH.read_bytes()
READER = types.ModuleType('confirmation_functional_reader_process')
READER.__file__ = str(READER_PATH)
exec(compile(READER_BYTES, str(READER_PATH), 'exec'), READER.__dict__)


def qualify(node, prepared, destination):
    """Use only current source and original sealed packages; functional results never become scientific observations."""
    assert sys.platform == 'linux' and 'NODE_OPTIONS' not in os.environ
    node = node.resolve(strict=True); prepared = prepared.resolve(strict=True)
    checksum = hashlib.sha256(node.read_bytes()).hexdigest()
    assert checksum in DESIGN['nodeExecutableSha256'].values(), 'Confirmation qualification: unrecognized SDK; never execute it'
    version = subprocess.check_output([str(node), '--version'], text=True).strip()
    assert DESIGN['nodeExecutableSha256'][version] == checksum
    destination = destination.parent.resolve(strict=True) / destination.name
    for protected in [REPOSITORY, prepared]:
        assert destination != protected and not destination.is_relative_to(protected) and not protected.is_relative_to(destination)
    assert not os.path.lexists(destination)
    destination.mkdir()
    index = dict(revision=POLICY['revision'], node=version, nodeExecutableSha256=checksum, complete=False,
                 functionalOnly=True, scientificCaptureExecuted=False, criteria=[], performanceAccepted=None, gateReevaluated=False)
    def save():
        pending = destination / ('.' + QUALIFICATION['indexFile'] + '.next')
        with pending.open('x') as output:
            output.write(json.dumps(index, indent=2) + '\n')
        pending.replace(destination / QUALIFICATION['indexFile'])
    source_digest = None
    save()
    try:
        for ordinal, criterion in enumerate(QUALIFICATION['criteria']):
            criterion_id = version + '/' + criterion
            directory = destination / str(ordinal)
            directory.mkdir()
            entry = dict(criterionId=criterion_id, directory=str(ordinal), complete=False)
            index['criteria'].append(entry); save()
            argv = [str(node), *POLICY['parentExecArgv'], str(SOURCE / 'criterion.cjs'), POLICY['functionalOption'],
                    str(prepared), str(directory / QUALIFICATION['criterionDirectory']), criterion_id]
            entry['supervisorExitCode'] = SUPERVISOR.supervise(POLICY['functionalMode'], directory / QUALIFICATION['supervisorFile'], argv)
            save()
            assert entry['supervisorExitCode'] == 0, 'Confirmation qualification: preserve rejected/partial criterion without retry'
            argv = [str(node), str(SOURCE / 'replay-functional.cjs'), POLICY['functionalOption'],
                    str(directory / QUALIFICATION['criterionDirectory']), str(prepared),
                    str(directory / QUALIFICATION['supervisorFile']), str(directory / QUALIFICATION['replayDirectory'])]
            result = READER.run_reader(argv, directory / QUALIFICATION['readerProcessDirectory'], QUALIFICATION['readerTimeoutSeconds'], SUPERVISOR.HELPERS)
            entry['readerExitCode'] = result['exitCode']; save()
            assert result['exitCode'] == 0, 'Confirmation qualification: independent reader rejected criterion; preserve its subtree receipt'
            expected = json.loads((directory / QUALIFICATION['replayDirectory'] / QUALIFICATION['expectedContextFile']).read_bytes())
            current_digest = expected['source']['profile']['currentFilesSha256']
            if source_digest is None:
                source_digest = current_digest
            assert current_digest == source_digest, 'Confirmation qualification: producer changed between criteria'
            entry['totals'] = json.loads((directory / QUALIFICATION['replayDirectory'] / QUALIFICATION['replayResultFile']).read_bytes())['totals']
            entry['complete'] = True; save()
        index['sourceFilesSha256'] = source_digest
        index['complete'] = True; save()
        return index
    except BaseException as error:
        index['failure'] = dict(name=type(error).__name__, message=str(error)); save()
        raise


if __name__ == '__main__':
    try:
        assert len(sys.argv) == 5 and sys.argv[1] == POLICY['functionalOption'], 'Provide --functional pinned-node sealed-package new-output'
        result = qualify(Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]))
        print(json.dumps(result))
    except Exception as error:
        print(json.dumps(dict(operation='Confirmation functional qualification', name=type(error).__name__, message=str(error))), file=sys.stderr)
        sys.exit(2)
