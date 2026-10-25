"""Read independently pinned exports without executing any archived producer."""
import csv
import hashlib
import json
from pathlib import Path


def policy():
    """Load feature-local identities and descriptive partition parameters."""
    return json.loads((Path(__file__).parent / 'constants/inputs.json').read_bytes())


def load_exports(directory):
    """Authenticate every input before parsing and group all spans per process."""
    declaration = policy()
    directory = Path(directory).resolve()
    for name, expected in declaration['files'].items():
        actual = hashlib.sha256((directory / name).read_bytes()).hexdigest()
        if actual != expected:
            raise ValueError(f'Calibration source: SHA256 mismatch for {name}')
    index = json.loads((directory / declaration['index']).read_bytes())
    analysis = json.loads((directory / declaration['analysis']).read_bytes())
    processes = {}
    with (directory / declaration['spans']).open(encoding='utf-8', newline='') as stream:
        for span in csv.DictReader(stream):
            identity = tuple(span[name] for name in declaration['processFields'])
            process = processes.setdefault(identity, {'identity': dict(zip(declaration['processFields'], identity)), 'spans': []})
            process['spans'].append(span)
    if len(processes) != analysis['totals']['processes']:
        raise ValueError('Calibration source: process coverage differs from original analysis')
    for ordinal, entry in enumerate(index['processes']):
        values = dict(entry['input'], node=entry['node'])
        identity = tuple(str(values[name]) for name in declaration['processFields'])
        process = processes[identity]
        process.update(ordinal=ordinal, startedAt=entry['startedAt'], finishedAt=entry['finishedAt'])
    if any('ordinal' not in process for process in processes.values()):
        raise ValueError('Calibration source: original index does not cover every process')
    return declaration, index, analysis, list(processes.values())
