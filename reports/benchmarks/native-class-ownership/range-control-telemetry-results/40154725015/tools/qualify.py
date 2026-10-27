"""Reconstruct and replay only the published AA data with the exact clean source and pinned Node binaries."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('Range AA result qualification requires non-optimized Python')

from collect import POLICY
from extract import extract
from materialize import materialize

SETTINGS = json.loads((Path(__file__).parent / 'constants/qualification.json').read_bytes())


def digest(filename):
    observed = hashlib.sha256()
    with filename.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            observed.update(chunk)
    return observed.hexdigest()


def qualify(repository, source, output, nodes):
    """Use current readers and a genuine recorded-source checkout; never dispatch capture or execute archived code."""
    repository = repository.resolve(strict=True)
    source = source.resolve(strict=True)
    packet = Path(__file__).parent.parent.resolve(strict=True)
    output = output.parent.resolve(strict=True) / output.name
    for protected in [packet, source]:
        assert output != protected and not output.is_relative_to(protected) and not protected.is_relative_to(output), \
            'Range AA qualification: output overlaps an input'
    assert (source / '.git').is_dir(), 'Range AA qualification: require a real Git directory in the source filesystem'
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source, text=True).strip()
    status = subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=source)
    assert head == POLICY['head'] and status == b'', 'Range AA qualification: use the exact clean recorded source'
    receipt = source / SETTINGS['sourceReceipt']['path']
    assert digest(receipt) == SETTINGS['sourceReceipt']['sha256']
    pins = json.loads(receipt.read_bytes())['files']
    assert len(pins) == SETTINGS['sourceReceipt']['files']
    for relative, expected in pins.items():
        assert digest(source / relative) == expected, relative
    bound_analysis = json.loads((packet / 'tools/constants/analysis.json').read_bytes())
    index_file = packet / 'metadata/original-index.json'
    assert digest(index_file) == bound_analysis['indexSha256']
    index = json.loads(index_file.read_bytes())
    assert index['sourceCommit'] == bound_analysis['sourceCommit'] == POLICY['head']
    assert len(nodes) == len(index['runtimes'])
    for node, recorded in zip(nodes, index['runtimes'], strict=True):
        assert digest(node) == recorded['sha256'], str(node)
        assert subprocess.check_output([str(node), '--version'], text=True).strip() == recorded['node'], str(node)
    output.mkdir()
    logs = output / SETTINGS['directories']['logs']
    logs.mkdir()
    transport = output / SETTINGS['directories']['transport']
    materialize(repository, packet, transport)
    extracted = extract(repository, transport, output / SETTINGS['directories']['extraction'])
    capture = Path(extracted['root']) / SETTINGS['captureDirectory']
    commands = []

    def command(label, argv, cwd=repository):
        with (logs / (label + '.stdout.log')).open('xb') as stdout, (logs / (label + '.stderr.log')).open('xb') as stderr:
            try:
                observed = subprocess.run(argv, cwd=cwd, stdout=stdout, stderr=stderr,
                                          timeout=SETTINGS['commandTimeoutSeconds'])
                record = {'argv': argv, 'cwd': str(cwd), 'exitCode': observed.returncode, 'timedOut': False}
            except subprocess.TimeoutExpired:
                record = {'argv': argv, 'cwd': str(cwd), 'exitCode': None, 'timedOut': True}
        commands.append(record)
        (output / SETTINGS['commandsFile']).write_text(json.dumps(commands, indent=2) + '\n', encoding='utf-8', newline='\n')
        assert record['exitCode'] == 0, 'Range AA qualification: failed read-only command ' + label

    exports = []
    replays = []
    for node, recorded in zip(nodes, index['runtimes'], strict=True):
        label = recorded['node']
        replay = logs / (label + '.stdout.log')
        command(label, [str(node), str(source / 'reports/benchmarks/native-class-ownership/range-control-telemetry/run.cjs'),
                        SETTINGS['verificationOperation'], str(capture)], source)
        replays.append(replay.read_bytes())
        destination = output / SETTINGS['exportDirectoryFormat'].format(node=label)
        command(label + '-export', [str(node), str(packet / 'tools/analyze.cjs'), str(capture), str(destination), str(replay)])
        exports.append({filename.name: digest(filename) for filename in destination.iterdir() if filename.is_file()})
    assert replays[0] == replays[1], 'Range AA qualification: strict replays differ between pinned Node versions'
    assert exports[0] == exports[1], 'Range AA qualification: exports differ between pinned Node versions'
    command('artifact-contracts', [sys.executable, '-B', str(packet / 'tools/artifact.spec.py'), str(packet), str(capture),
                                   str(output / SETTINGS['exportDirectoryFormat'].format(node=index['runtimes'][0]['node'])),
                                   str(output / SETTINGS['exportDirectoryFormat'].format(node=index['runtimes'][1]['node']))])
    command('description', [sys.executable, '-B', str(packet / 'tools/describe.py'), str(packet), str(output / SETTINGS['descriptionDirectory'])])
    command('description-contracts', [sys.executable, '-B', str(packet / 'tools/describe.spec.py'), str(packet)])
    after = subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all'], cwd=source)
    assert after == status
    result = {'runId': POLICY['runId'], 'artifactId': POLICY['artifactId'], 'sourceCommit': head,
              'sourceGitStatusRaw': status.decode(), 'strictReplaysByteIdentical': True, 'exportsByteIdentical': exports[0],
              'newMeasurements': 0, 'DOMExecuted': False, 'performanceAccepted': None, 'gateReevaluated': False,
              'nodeVersions': [recorded['node'] for recorded in index['runtimes']]}
    (output / SETTINGS['qualificationFile']).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8', newline='\n')
    return result


if __name__ == '__main__':
    assert len(sys.argv) == 6, 'Provide repository, clean recorded source, fresh output, Node22 and Node24'
    print(json.dumps(qualify(*map(Path, sys.argv[1:4]), list(map(Path, sys.argv[4:6])))))
