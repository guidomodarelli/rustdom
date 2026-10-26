"""Verify the complete metadata tar and terminal transport journals without executing archived code."""
import hashlib
import json
from pathlib import Path
import sys
import tarfile

if sys.flags.optimize:
    raise RuntimeError('Completed transport verification requires non-optimized Python')

source = Path(__file__).resolve().parent.parent
publication = source/'.cache/ci-4196-bounded-publication'
linux = Path('\\\\wsl.localhost\\Rustdom-Validation-20261025\\run')
work = linux/'rustdom-ci-4196-publication-20261026'
raw = (publication/'summary.json').read_bytes()
summary = json.loads(raw)
assert summary['finalEvidenceCommit'] == 'abbb01ee02a07950b723a4b7930a778273bde0a1'
assert summary['allFourteenOriginalArchivesRoundTripped'] and summary['originalArchiveBytes'] == 234895282
parts = [part for record in summary['artifacts'] for part in record['parts']]+summary['metadataArchive']['parts']
assert len(parts) == 27
assert all(part['independentRemoteDigestVerified'] and part['bothDisposableRepositoriesRemoved'] for part in parts)
assert sum(part['bytes'] for part in parts) == 234895282+1620957
archive_path = work/'collection-metadata.tar.gz'
assert list(work.iterdir()) == [archive_path]
assert archive_path.stat().st_size == summary['metadataArchive']['bytes'] == 1620957
assert hashlib.sha256(archive_path.read_bytes()).hexdigest() == summary['metadataArchive']['sha256']
expected = {member['path']:member for member in summary['metadataMembers']}
assert len(expected) == len(summary['metadataMembers'])
seen = set()
with tarfile.open(archive_path,'r:gz') as archive:
    for member in archive:
        assert member.isfile() and member.name in expected and member.name not in seen
        seen.add(member.name)
        assert member.size == expected[member.name]['bytes']
        checksum = hashlib.sha256()
        count = 0
        with archive.extractfile(member) as reader:
            for chunk in iter(lambda:reader.read(1048576),b''):
                checksum.update(chunk)
                count += len(chunk)
                assert count <= member.size
        assert count == member.size and checksum.hexdigest() == expected[member.name]['sha256']
assert seen == set(expected)
processes = [json.loads(path.read_bytes()) for path in publication.glob('*.process.json')]
assert processes and all(process['exitCode'] == 0 and not process['subtree']['ownedDescendantsRemaining'] for process in processes)
assert not (publication/'failure.json').exists()
result = {'summarySha256':hashlib.sha256(raw).hexdigest(),'sourceCommit':summary['sourceCommit'],
    'finalEvidenceCommit':summary['finalEvidenceCommit'],'partsVerified':27,'originalArchivesVerified':14,
    'originalArchiveBytes':234895282,'metadataTarBytes':1620957,'metadataTarMembersVerified':len(seen),
    'commandJournalsWithClosedSubtree':len(processes),'disposableBareRepositoriesRemoved':len(parts)*2,
    'largestVerifiedRepositoryPairSnapshotBytes':max(part['publisherRepositoryBytes']+part['readerRepositoryBytes'] for part in parts),
    'snapshotIsPeakRss':False,'universalLeakAbsenceProven':False,'originalsAndMetadataTarRetained':True,
    'archivedCodeExecuted':False,'scientificCaptureExecuted':False,'performanceAccepted':None,'gateReevaluated':False}
(source/'.cache/ci-4196-completed-transport-verification.json').write_bytes(json.dumps(result,indent=2).encode()+b'\n')
print(json.dumps(result))
