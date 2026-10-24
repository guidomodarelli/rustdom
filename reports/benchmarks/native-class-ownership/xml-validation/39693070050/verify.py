"""Reuse the frozen reviewed A/A verifier; do not execute workloads or alter historical evidence."""
import importlib.util
import json
from pathlib import Path

directory = Path(__file__).resolve().parent
source = directory.parents[1] / 'unplanned-xml/39662377152/verify.py'
spec = importlib.util.spec_from_file_location('historical_aa_verifier', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

if __name__ == '__main__':
    print(json.dumps(module.verify(directory)))
