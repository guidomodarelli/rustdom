"""Compare recorded build metadata and actual canonical source bytes, without loading a runtime or measuring workloads."""
import argparse
import copy
import hashlib
import json
import pathlib

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--old-preparation', type=pathlib.Path, required=True)
parser.add_argument('--fresh-index', type=pathlib.Path, required=True)
parser.add_argument('--publication', type=pathlib.Path, required=True)
parser.add_argument('--harness', type=pathlib.Path, required=True)
parser.add_argument('--package', type=pathlib.Path, required=True)
parser.add_argument('--output', type=pathlib.Path, required=True)
arguments = parser.parse_args()
old_index_path = arguments.old_preparation / 'index.json'
old = json.loads(old_index_path.read_bytes())
fresh = json.loads(arguments.fresh_index.read_bytes())
publication = json.loads(arguments.publication.read_bytes())
measured = publication['qualifiedSources']['identity']
source_indices = [old['sourceProvenance']['B'], measured]
source_roots = [arguments.old_preparation / 'sources', arguments.harness]
source_files = []
hashes = []
for identity, root in zip(source_indices, source_roots):
    digest = hashlib.sha256()
    files = {}
    for name in identity['measuredSources']:
        raw = (root / name).read_bytes()
        digest.update(name.encode() + b'\0' + raw + b'\0')
        files[name] = {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    if digest.hexdigest() != identity['sourceHash']:
        raise ValueError('Canonical source bytes differ from the recorded identity: ' + str(root))
    source_files.append(files)
    hashes.append(digest.hexdigest())
if fresh['sourceProvenance']['B']['sourceHash'] != hashes[1]:
    raise ValueError('Fresh build canonical identity differs from the measured harness')
source_differences = [{'path': name, 'compiled': source_files[0].get(name), 'measured': source_files[1].get(name)}
                      for name in sorted(set(source_files[0]) | set(source_files[1]))
                      if source_files[0].get(name) != source_files[1].get(name)]
distributions = {}
for label in sorted(set(old['distributions']) | set(fresh['distributions'])):
    before = {entry['path']: entry for entry in old['distributions'].get(label, {}).get('files', [])}
    after = {entry['path']: entry for entry in fresh['distributions'].get(label, {}).get('files', [])}
    differences = [{'path': name, 'before': before.get(name), 'after': after.get(name)}
                   for name in sorted(set(before) | set(after)) if before.get(name) != after.get(name)]
    distributions[label] = {'oldFileEntries': len(before), 'freshFileEntries': len(after), 'differences': differences}
old_package_path = arguments.old_preparation / 'packages/B/package.json'
old_package = json.loads(old_package_path.read_bytes())
current_package = json.loads(arguments.package.read_bytes())
old_package_sha = hashlib.sha256(old_package_path.read_bytes()).hexdigest()
current_package_sha = hashlib.sha256(arguments.package.read_bytes()).hexdigest()
old_manifest_entry = next(entry for entry in old['distributions']['B']['files'] if entry['path'] == 'package.json')
fresh_manifest_entry = next(entry for entry in fresh['distributions']['B']['files'] if entry['path'] == 'package.json')
if old_manifest_entry['sha256'] != old_package_sha or fresh_manifest_entry['sha256'] != current_package_sha:
    raise ValueError('Actual package manifests do not match the corresponding recorded distributions')
adjusted_package = copy.deepcopy(old_package)
adjusted_package['scripts']['test:compat'] = current_package['scripts']['test:compat']
result = {'verifiedCanonicalSources': True, 'scope': 'Canonical source correspondence and authenticated index metadata only',
          'oldPreparationId': old['preparationId'], 'freshPreparationId': fresh['preparationId'],
          'compiledCanonicalSourceHash': hashes[0], 'measuredCanonicalSourceHash': hashes[1],
          'oldCanonicalFileCount': len(source_files[0]), 'measuredCanonicalFileCount': len(source_files[1]),
          'canonicalSourceDifferences': source_differences,
          'allCanonicalDifferencesInBenchmarks': all(entry['path'].startswith('benchmarks/') for entry in source_differences),
          'distributionMetadata': distributions,
          'dependenciesMetadataIdentical': old['dependencies'] == fresh['dependencies'],
          'oldDependenciesSha256': old['dependencies']['sha256'], 'freshDependenciesSha256': fresh['dependencies']['sha256'],
          'packageManifest': {'oldSha256': old_package_sha, 'currentSha256': current_package_sha,
                              'singleFieldAdjustment': 'scripts.test:compat',
                              'allOtherFieldsEqual': adjusted_package == current_package},
          'freshPhysicalRuntimeTreeVerified': False, 'runtimeLoaded': False, 'newBuildExecuted': False,
          'measurementExecuted': False, 'performanceAccepted': None, 'xmlEligibilityChanged': False}
arguments.output.mkdir(parents=True, exist_ok=False)


def save(name, value):
    (arguments.output / name).write_bytes((json.dumps(value, indent=2) + '\n').encode())


save('comparison.json', result)
save('canonical-files.json', {'compiled': source_files[0], 'measured': source_files[1]})
inputs = [('old-index.json', old_index_path), ('fresh-index.json', arguments.fresh_index),
          ('publication.json', arguments.publication), ('old-package.json', old_package_path),
          ('current-package.json', arguments.package), ('producer.py', pathlib.Path(__file__))]
raw_manifest = {}
for name, source in inputs:
    raw = source.read_bytes()
    (arguments.output / name).write_bytes(raw)
    raw_manifest[name] = {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
save('inputs.json', raw_manifest)
print(json.dumps({name: result[name] for name in ['oldCanonicalFileCount', 'measuredCanonicalFileCount',
      'allCanonicalDifferencesInBenchmarks', 'dependenciesMetadataIdentical', 'packageManifest', 'freshPhysicalRuntimeTreeVerified']}))
