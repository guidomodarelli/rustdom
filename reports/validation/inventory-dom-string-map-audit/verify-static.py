"""Verify the real static inventory proposal and preserved correspondence artifacts, without invoking DOM or workloads."""
import collections
import hashlib
import json
import pathlib
import tarfile

repository = pathlib.Path.cwd()
inventory = repository / 'reports/progress/inventory'
evidence = repository / 'reports/validation/inventory-dom-string-map-audit'
proposal = json.loads((inventory / 'dom-string-map-audit-proposal.json').read_bytes())
if proposal['status'] != 'proposal-only' or any(proposal[name] is not False for name in ['ledgerModified', 'runtimeExecuted', 'testsExecuted', 'performanceMeasured', 'newRustImplementation']):
    raise ValueError('Static proposal claims runtime execution, new implementation or ledger integration')
reference = json.loads((inventory / 'reference.json').read_bytes())
catalog = json.loads((evidence / 'catalog-integrity.json').read_bytes())
for name, expected in catalog['files'].items():
    if pathlib.Path(name).name != name or hashlib.sha256((inventory / name).read_bytes()).hexdigest() != expected:
        raise ValueError('Catalog or ledger changed since the static proposal: ' + name)
if proposal['referenceVersion'] != reference['package']['version'] or proposal['referenceSourceHash'] != reference['package']['sourceHash']:
    raise ValueError('Proposal references another jsdom catalog')
surface = json.loads((inventory / 'surface.json').read_bytes())
units = json.loads((inventory / 'implementation-units.json').read_bytes())
audits = json.loads((inventory / 'audits.json').read_bytes())
summary = json.loads((inventory / 'summary.json').read_bytes())
ids = {entry['id'] for entry in reference['files'] + surface['apis'] + units}
reference_counts = {'files': len(reference['files']), 'apis': len(surface['apis']), 'callableUnits': len(units)}
if len(ids) != 12151 or reference_counts != {'files': 531, 'apis': 4374, 'callableUnits': 7246}:
    raise ValueError('Reference inventory denominator changed')
rows = proposal['moduleProposals'] + proposal['unitProposals'] + proposal['apiProposals']
if len(rows) != 12 or len({entry['id'] for entry in rows}) != len(rows):
    raise ValueError('Proposed rows have unexpected scope or duplicate IDs')
if any(entry['id'] not in ids for entry in rows + proposal['deferred']):
    raise ValueError('Proposal contains an unknown reference ID')
if set(audits).intersection(entry['id'] for entry in rows):
    raise ValueError('Proposal would overwrite a published audit')
counts = dict(collections.Counter(entry['status'] for entry in proposal['unitProposals']))
if counts != {'rust-complete': 6, 'hybrid': 3}:
    raise ValueError('Post-review body classifications differ from the declared proposal')
for entry in proposal['unitProposals']:
    if (entry['status'] == 'rust-complete') != (entry['pending'] == []):
        raise ValueError('Body classification and remaining work disagree: ' + entry['id'])
module_id = 'module:lib/jsdom/living/nodes/DOMStringMap-impl.js'
declared_bodies = {entry['id'] for entry in proposal['unitProposals'] + proposal['deferred'] if entry['id'].startswith('unit:')}
if declared_bodies != {entry['id'] for entry in units if entry['moduleId'] == module_id}:
    raise ValueError('A reference DOMStringMap body disappeared from proposed/deferred scope')
declared_apis = {entry['id'] for entry in proposal['apiProposals'] + proposal['deferred'] if entry['id'].startswith('api:')}
if declared_apis != {entry['id'] for entry in surface['apis'] if entry['id'].startswith('api:Window.DOMStringMap')}:
    raise ValueError('A public DOMStringMap declaration disappeared from proposed/deferred scope')
current = dict(collections.Counter(name.split(':')[0] for name in audits))
if current != {'module': 18, 'unit': 55, 'api': 32}:
    raise ValueError('Published ledger counts changed')
if any(summary['counts'][dimension]['total'] != count for dimension, count in reference_counts.items()):
    raise ValueError('Summary denominators differ from the actual reference catalog')
if summary['counts']['files']['audited'] != current['module'] or summary['counts']['apis']['audited'] != current['api'] or summary['counts']['callableUnits']['audited'] != current['unit']:
    raise ValueError('Summary audit counts differ from the actual published ledger')
if summary['scopeClosed'] is not False or summary['migrationPercent'] is not None:
    raise ValueError('Open inventory scope was incorrectly closed')
receipt = json.loads((evidence / 'receipt.json').read_bytes())
raw_manifest = json.loads((evidence / 'raw-files.json').read_bytes())
archive_path = evidence / 'sources.tar.gz'
if hashlib.sha256(archive_path.read_bytes()).hexdigest() != receipt['archiveSha256']:
    raise ValueError('Preserved static source archive digest changed')
with tarfile.open(archive_path, 'r:gz') as archive:
    if set(archive.getnames()) != set(raw_manifest) or len(archive.getmembers()) != len(raw_manifest):
        raise ValueError('Static source archive member coverage changed')
    for member in archive:
        raw = archive.extractfile(member).read()
        entry = raw_manifest[member.name]
        if not member.isfile() or len(raw) != entry['bytes'] or hashlib.sha256(raw).hexdigest() != entry['sha256']:
            raise ValueError('Static source archive member differs: ' + member.name)
    official_bytes = archive.extractfile('official-index.json').read()
    if hashlib.sha256(official_bytes).hexdigest() != receipt['officialIndexSha256']:
        raise ValueError('Official preparation index differs from its authenticated identity')
    official = json.loads(official_bytes)
    if official['preparationId'] != receipt['officialPreparationId'] or not official['complete'] or official['inputsBefore'] != official['inputsAfter']:
        raise ValueError('Official preparation is incomplete or has unstable build inputs')
    for source in receipt['mappedLocalSources']:
        raw = archive.extractfile('local/' + source['path']).read()
        if raw != (repository / source['path']).read_bytes() or hashlib.sha256(raw).hexdigest() != official['files']['sources/' + source['path']]:
            raise ValueError('Local source no longer matches the official snapshot: ' + source['path'])
    built = {entry['path']: entry for entry in official['distributions']['B']['files']}
    for name in receipt['builtFilesVerified']:
        raw = archive.extractfile('built/' + name).read()
        if len(raw) != built[name]['bytes'] or hashlib.sha256(raw).hexdigest() != built[name]['sha256']:
            raise ValueError('Preserved built source differs from the B distribution: ' + name)
    sources = {entry['path']: entry for entry in reference['files']}
    for name in raw_manifest:
        if name.startswith('reference/'):
            raw = archive.extractfile(name).read()
            if hashlib.sha256(raw).hexdigest() != sources[name.removeprefix('reference/')]['sha256']:
                raise ValueError('Reference source differs from the versioned catalog: ' + name)
result = {'verified': True, 'kind': 'static-inventory-and-artifact-integrity', 'proposalRows': len(rows),
          'bodyStates': counts, 'currentAudits': current, 'referenceCounts': reference_counts, 'referenceIds': len(ids), 'deferredRows': len(proposal['deferred']),
          'sourceMembersVerified': len(raw_manifest), 'ledgerModified': False, 'runtimeExecuted': False,
          'runtimeTestsExecuted': False, 'benchmarkExecuted': False,
          'runtimeTestsDeferredReason': 'The original ownership study is active; this proposal changes neither runtime nor ledger.'}
target = evidence / 'static-checks.json'
target.write_bytes((json.dumps(result, indent=2) + '\n').encode())
print(json.dumps(result))
