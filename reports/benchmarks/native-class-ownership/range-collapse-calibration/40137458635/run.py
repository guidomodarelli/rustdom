"""Export deterministic diagnostics into a new directory, leaving inputs intact."""
import csv
import json
from pathlib import Path
import sys

from source import load_exports
from metrics import diagnose


def run(source, output):
    """Authenticate original exports, reproduce medians and publish every pair."""
    source = Path(source).resolve()
    output = Path(output).resolve()
    if source == output or source in output.parents or output in source.parents:
        raise ValueError('Calibration export: source and output must be disjoint')
    declaration, _, analysis, processes = load_exports(source)
    summary, pairs = diagnose(declaration, analysis, processes)
    output.mkdir()
    (output / 'diagnostic.json').write_bytes((json.dumps(summary, ensure_ascii=False, indent=2) + '\n').encode())
    fields = [name for name in pairs[0] if name != 'factors'] + list(declaration['factorMasks'])
    with (output / 'pairs.csv').open('x', encoding='utf-8', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\n')
        writer.writeheader()
        for pair in pairs:
            writer.writerow({name: value for name, value in pair.items() if name != 'factors'} | pair['factors'])
    return summary


if __name__ == '__main__':
    result = run(*sys.argv[1:])
    print(json.dumps({name: value for name, value in result.items() if name != 'rows'}))
