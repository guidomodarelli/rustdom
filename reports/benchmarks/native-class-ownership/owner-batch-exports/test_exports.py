"""Real two-SDK archive/CSV integration; expected times come from independently published reader outputs, never fabricated timings."""
import csv
import gzip
import hashlib
import json
import os
import py_compile
import shutil
import subprocess
import sys
import tarfile
import unittest
from collections import Counter, defaultdict
from pathlib import Path

source = Path(__file__).resolve().parent
node = Path(os.environ['RUSTDOM_OWNER_BATCH_EXPORT_NODE']).resolve(strict=True)
collection = Path(os.environ['RUSTDOM_OWNER_BATCH_EXPORT_COLLECTION']).resolve(strict=True)
oracle = Path(os.environ['RUSTDOM_OWNER_BATCH_EXPORT_ORACLE']).resolve(strict=True)
root = Path(os.environ['RUSTDOM_OWNER_BATCH_EXPORT_TEST_OUTPUT'])
assert not root.exists()
root.mkdir()
binding = collection / 'authenticated-binding.json'


def read(filename):
    return json.loads(Path(filename).read_bytes())


def digest(filename):
    return hashlib.sha256(Path(filename).read_bytes()).hexdigest()


def csv_rows(filename):
    with gzip.open(filename, 'rt', encoding='utf-8', newline='') as stream:
        return list(csv.DictReader(stream))


class ExportContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.invocations = []
        published = read(oracle.parents[1] / 'manifest.json')['files']
        for version in ['22.12.0', '24.14.1']:
            relative = 'reports/validation/owner-batch-authenticated-replay/20261025/node22/complete/part-' + version + '.json'
            assert digest(oracle / ('part-' + version + '.json')) == published[relative], 'Independent published oracle changed'
        cls.complete = root / 'complete'
        result = cls.invoke('complete', cls.complete)
        if result.returncode != 0:
            raise AssertionError(result.stderr)
        cls.summary = read(cls.complete / 'export-summary.json')

    @classmethod
    def invoke(cls, name, output, selected_binding=binding, operation='--functional', script=source / 'export.py'):
        args = [sys.executable, '-B', str(script), str(node), operation, str(selected_binding), str(collection), str(output)]
        result = subprocess.run(args, capture_output=True, text=True)
        (root / (name + '.stdout.log')).write_text(result.stdout, encoding='utf-8')
        (root / (name + '.stderr.log')).write_text(result.stderr, encoding='utf-8')
        cls.invocations.append({'name': name, 'argv': args, 'exitCode': result.returncode})
        return result

    @classmethod
    def tearDownClass(cls):
        (root / 'observations.json').write_text(json.dumps({'invocations': cls.invocations,
            'DOMExecuted': False, 'newBenchmarkSamples': False, 'performanceAccepted': None}, indent=2) + '\n', encoding='utf-8')

    def test_authentic_source_complete_counts_and_non_native_missingness(self):
        summary = self.summary
        self.assertTrue(summary['complete']); self.assertTrue(summary['transportAuthenticated'])
        self.assertFalse(summary['captureAuthenticated']); self.assertIsNone(summary['performanceAccepted'])
        self.assertFalse(summary['gateReevaluated']); self.assertFalse(summary['newBenchmarkSamples'])
        self.assertEqual(summary['sourceRunId'], 40224283558)
        self.assertEqual(summary['sourceCommit'], 'e7895fb0daeb7858ba99805cff21a07f5767241f')
        self.assertEqual(summary['counts'], {'processes': 64, 'measuredDurations': 9216, 'warmupDurations': 3072,
            'blocks': 768, 'windows': 768, 'documents': 768, 'cleanupEndpoints': 192, 'parentSnapshots': 6,
            'nativeCounterRows': 21376, 'nativeProcesses': 32, 'nonNativeProcesses': 32, 'firstCleanupNotClear': 4})
        self.assertFalse(summary['scope']['taskDurationsAreIndependentReplicates'])
        self.assertFalse(summary['scope']['peakMemoryMeasured']); self.assertFalse(summary['scope']['universalLeakAbsenceClaimed'])
        self.assertFalse((self.complete / 'tables/comparisons.json').exists())

    def test_every_original_measured_and_warmup_value_roundtrips_at_its_process_grain(self):
        rows = csv_rows(self.complete / 'tables/tasks.csv.gz')
        self.assertEqual(Counter(row['stage'] for row in rows), {'measured': 9216, 'warmup': 3072})
        primary = lambda row: tuple(row[key] for key in ['nodeVersion', 'phase', 'engine', 'label', 'position', 'rowIndex', 'blockIndex', 'taskIndex'])
        self.assertEqual(len({primary(row) for row in rows}), 12288)
        groups = defaultdict(list)
        for row in rows:
            groups[tuple(row[key] for key in ['nodeVersion', 'phase', 'engine', 'label', 'position', 'rowIndex'])].append(row)
        for version in ['22.12.0', '24.14.1']:
            original = read(oracle / ('part-' + version + '.json'))
            self.assertEqual(original['sourceCommit'], self.summary['sourceCommit'])
            for entry in original['entries']:
                key = ('v' + version,) + tuple(str(entry[field]) for field in ['phase', 'engine', 'label', 'position', 'rowIndex'])
                values = sorted(groups[key], key=lambda row: (int(row['blockIndex']), int(row['taskIndex'])))
                self.assertEqual([float(row['durationMs']) for row in values if row['stage'] == 'measured'], entry['observation']['samplesMs'])
                self.assertEqual([float(row['durationMs']) for row in values if row['stage'] == 'warmup'], entry['observation']['warmupSamplesMs'])
                self.assertEqual({row['outputHash'] for row in values}, {entry['observation']['outputHash']})

    def test_unclear_first_rounds_boolean_counters_and_owner_endpoints_are_not_normalized(self):
        cleanup = csv_rows(self.complete / 'tables/cleanup.csv.gz')
        self.assertEqual(len(cleanup), 192)
        self.assertEqual(sum(row['clear'] == 'false' for row in cleanup), 4)
        example = next(row for row in cleanup if row['nodeVersion'] == 'v22.12.0' and row['pid'] == '3140' and row['round'] == '1')
        self.assertEqual((example['survivingWindows'], example['survivingDocuments'], example['clear']), ('1', '1', 'false'))
        self.assertEqual(example['physicalDistribution'], 'A0')
        for row in cleanup:
            self.assertEqual(row['nativeApplicable'], 'true' if row['engine'] == 'rustdom' else 'false')
            if row['round'] in ['2', '3']:
                self.assertEqual((row['clear'], row['survivingWindows'], row['survivingDocuments']), ('true', '0', '0'))
        native = csv_rows(self.complete / 'tables/native-counters.csv.gz')
        self.assertEqual(len(native), 21376)
        self.assertEqual({row['engine'] for row in native}, {'rustdom'})
        boolean = [row for row in native if row['valueType'] == 'boolean']
        self.assertTrue(boolean)
        self.assertTrue(all(row['delta'] == '' and row['value'] in ['true', 'false'] for row in boolean))
        example = next(row for row in native if row['nodeVersion'] == 'v22.12.0' and row['pid'] == '3140' and row['round'] == '1' and row['field'] == 'liveNodes')
        self.assertEqual(example['value'], '7')
        parents = csv_rows(self.complete / 'tables/parents.csv.gz')
        self.assertEqual(len(parents), 6)
        self.assertEqual(Counter(row['stage'] for row in parents), {'before-workers': 2, 'after-first-half': 2, 'after-workers': 2})

    def test_process_block_means_and_original_interval_starts_are_preserved(self):
        fields = ['nodeVersion', 'phase', 'engine', 'label', 'position', 'rowIndex']
        key = lambda row: tuple(row[field] for field in fields)
        processes = {key(row): row for row in csv_rows(self.complete / 'tables/processes.csv.gz')}
        blocks = {key(row) + (int(row['blockIndex']),): row for row in csv_rows(self.complete / 'tables/blocks.csv.gz')}
        self.assertEqual(len(processes), 64); self.assertEqual(len(blocks), 768)
        for version in ['22.12.0', '24.14.1']:
            for entry in read(oracle / ('part-' + version + '.json'))['entries']:
                primary = ('v' + version,) + tuple(str(entry[field]) for field in fields[1:])
                self.assertEqual(float(processes[primary]['processMeanMs']), entry['observation']['processMeanMs'])
                for block in entry['observation']['blockMeans']:
                    self.assertEqual(float(blocks[primary + (block['blockIndex'],)]['meanMs']), block['meanMs'])
        original = collection / 'tar/node22.tar.xz'
        artifact_id = read(binding)['artifacts']['22.12.0']['id']
        member = next(item for item in read(collection / ('artifact-' + str(artifact_id)) / 'members.json') if item['path'] == 'functional-part.tar.xz')
        self.assertEqual(digest(original), member['sha256'])
        with tarfile.open(original, 'r:xz') as archive:
            prefix = 'owner-batch-functional-part/'
            index = json.load(archive.extractfile(prefix + 'index.json'))
            process = next(item for item in index['processes'] if item['input']['engine'] == 'rustdom' and item['input']['label'] == 'A' and item['input']['rowIndex'] == 0)
            report = json.load(archive.extractfile(prefix + process['directory'] + '/report.json'))
        self.assertEqual(report['pid'], 3140)
        rows = {(int(row['blockIndex']), int(row['taskIndex'])): row for row in csv_rows(self.complete / 'tables/tasks.csv.gz') if row['nodeVersion'] == 'v22.12.0' and row['pid'] == '3140'}
        self.assertEqual(len(rows), 192)
        for block in report['blocks']:
            for task in block['tasks']:
                self.assertEqual(float(rows[(block['blockIndex'], task['index'])]['processMonotonicStartMs']), task['startMs'])

    def test_independent_manifest_and_existing_evidence_preservation(self):
        manifest = read(self.complete / 'export-manifest.json')
        for name, expected in manifest['files'].items():
            self.assertEqual((self.complete / name).stat().st_size, expected['bytes'])
            self.assertEqual(digest(self.complete / name), expected['sha256'])
        for name, expected in manifest['tableFiles'].items():
            self.assertEqual(digest(self.complete / 'tables' / name), expected['sha256'])
        before = digest(self.complete / 'export-summary.json')
        result = self.invoke('preserve-existing', self.complete)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(digest(self.complete / 'export-summary.json'), before)

    def test_wrong_artifact_pin_preserves_failed_decision_and_produces_no_tables(self):
        changed = read(binding); changed['artifacts']['22.12.0']['digest'] = 'sha256:' + '0' * 64
        filename = root / 'wrong-binding.json'; filename.write_text(json.dumps(changed), encoding='utf-8')
        output = root / 'wrong-artifact'
        result = self.invoke('wrong-artifact', output, filename)
        self.assertNotEqual(result.returncode, 0)
        summary = read(output / 'export-summary.json')
        self.assertFalse(summary['complete']); self.assertIsNone(summary['performanceAccepted'])
        self.assertFalse((output / 'tables').exists()); self.assertTrue((output / 'verified/decision.json').is_file())

    def test_functional_data_cannot_be_promoted_to_scientific_acceptance(self):
        output = root / 'false-science'
        result = self.invoke('false-science', output, operation='--verify')
        self.assertNotEqual(result.returncode, 0)
        summary = read(output / 'export-summary.json')
        self.assertFalse(summary['complete']); self.assertIsNone(summary['performanceAccepted']); self.assertFalse(summary['gateReevaluated'])
        self.assertFalse((output / 'tables').exists())

    def test_optimized_python_rejects_before_reading_paths_or_launching_node(self):
        directory = root / 'empty-optimized'; directory.mkdir()
        for name, options, environment in [('flag', ['-O'], dict(os.environ)), ('environment', [], dict(os.environ, PYTHONOPTIMIZE='1'))]:
            result = subprocess.run([sys.executable, *options, str(source / 'export.py'), 'missing-node', '--functional', 'missing-binding', 'missing-collection', 'missing-output'],
                                    cwd=directory, env=environment, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0, name)
            self.assertIn('refusing before filesystem or commands', result.stderr)
            self.assertEqual(list(directory.iterdir()), [])

    def test_current_formatter_source_bypasses_valid_stale_bytecode_in_an_owned_copy(self):
        copied = source.parent / ('owner-batch-exports-cache-fixture-' + str(os.getpid()))
        self.assertFalse(copied.exists()); copied.mkdir()
        for name in ['export.py', 'archive.py', 'tables.py', 'invoke.cjs', 'constants/exports.json']:
            target = copied / name; target.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(source / name, target)
        module = copied / 'tables.py'; raw = module.read_bytes(); metadata = module.stat()
        marker = root / 'stale-bytecode-marker.txt'
        benign = ('from pathlib import Path\nPath(' + repr(str(marker)) + ').write_text("owned cache control")\n').encode()
        self.assertLess(len(benign), len(raw))
        module.write_bytes(benign + b' ' * (len(raw) - len(benign)))
        os.utime(module, ns=(metadata.st_atime_ns, metadata.st_mtime_ns))
        py_compile.compile(str(module), doraise=True, invalidation_mode=py_compile.PycInvalidationMode.TIMESTAMP)
        module.write_bytes(raw); os.utime(module, ns=(metadata.st_atime_ns, metadata.st_mtime_ns))
        control = subprocess.run([sys.executable, '-B', '-c', 'import sys;sys.path.insert(0,sys.argv[1]);import tables', str(copied)], capture_output=True, text=True)
        self.assertEqual(control.returncode, 0, control.stderr); self.assertTrue(marker.is_file())
        marker.unlink()  # Owned harmless marker only; no benchmark or platform dependency is substituted.
        output = root / 'current-source'
        result = self.invoke('current-source', output, script=copied / 'export.py')
        self.assertEqual(result.returncode, 0, result.stderr); self.assertFalse(marker.exists())
        for name in self.summary['tableFiles']:
            self.assertEqual(digest(output / 'tables' / name), digest(self.complete / 'tables' / name))


if __name__ == '__main__':
    unittest.main()
