"""Install only the authenticated Linux CLI executable into a new private transport directory."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

if sys.flags.optimize or sys.platform != 'linux':
    raise RuntimeError('Native CLI installation requires non-optimized Python on Linux')
source = Path(__file__).resolve().parent.parent
evidence = source/'.cache/native-gh-2.103.3-qualification'
destination = Path('/run/rustdom-native-gh-2.103.3')
archive_name = 'gh_2.103.3_linux_amd64.tar.gz'
checksums_name = 'gh_2.103.3_checksums.txt'
expected = {
    archive_name: (679195621,15031972,'4c806978ffce1cec70853302a56d70ac6da4f19bae7adca4e1a8ab00633dd91d'),
    checksums_name: (679195516,1971,'f756e7859d90dbb5e85aae5194206c37da220bec9bac23d3d659078a8e766fdc'),
}
release = json.loads((evidence/'release.json').read_bytes())
if release['tag_name'] != 'v2.103.3' or release['draft'] or release['prerelease']:
    raise ValueError('CLI release identity is not the authenticated stable version')
for name,(identity,size,checksum) in expected.items():
    matches = [asset for asset in release['assets'] if asset['name'] == name]
    if len(matches) != 1 or matches[0]['id'] != identity or matches[0]['size'] != size or matches[0]['digest'] != 'sha256:'+checksum:
        raise ValueError('CLI release asset identity differs: '+name)
    filename = evidence/name
    if filename.is_symlink() or filename.stat().st_size != size or hashlib.sha256(filename.read_bytes()).hexdigest() != checksum:
        raise ValueError('CLI release asset bytes differ: '+name)
checksum_rows = [line.split() for line in (evidence/checksums_name).read_text(encoding='utf-8').splitlines()]
matches = [row for row in checksum_rows if len(row) == 2 and row[1] == archive_name]
if matches != [[expected[archive_name][2],archive_name]]:
    raise ValueError('CLI checksums file disagrees with the GitHub asset digest')
if destination.exists() or destination.is_symlink():
    raise FileExistsError('Native CLI installation destination already exists; preserve it unchanged')
with tarfile.open(evidence/archive_name,'r:gz') as archive:
    members = archive.getmembers()
    matches = [member for member in members if member.name == 'gh_2.103.3_linux_amd64/bin/gh']
    if len(matches) != 1 or not matches[0].isfile() or not 0 < matches[0].size <= 67108864:
        raise ValueError('CLI archive does not contain one bounded regular Linux executable')
    destination.mkdir(mode=0o700)
    binary = destination/'gh'
    with archive.extractfile(matches[0]) as reader,binary.open('xb') as writer:
        shutil.copyfileobj(reader,writer,length=1048576)
    if binary.stat().st_size != matches[0].size:
        raise ValueError('Native CLI executable extraction was partial')
    with binary.open('rb') as reader:
        if reader.read(4) != b'\x7fELF':
            raise ValueError('CLI executable is not a native ELF file')
    os.chmod(binary,0o500)
    version = subprocess.check_output([str(binary),'--version'],timeout=15)
    if not version.startswith(b'gh version 2.103.3 '):
        raise ValueError('Installed native CLI reports a different version')
    (evidence/'native-version.stdout').write_bytes(version)
    inventory = [{'path':member.name,'bytes':member.size,'type':member.type.decode('ascii')} for member in members]
    receipt = {'release':'v2.103.3','releaseUrl':release['html_url'],'assets':[
        {'id':identity,'name':name,'bytes':size,'sha256':checksum} for name,(identity,size,checksum) in expected.items()],
        'archiveInventory':inventory,'extractedMember':matches[0].name,'binaryBytes':binary.stat().st_size,
        'binarySha256':hashlib.sha256(binary.read_bytes()).hexdigest(),'binaryFormat':'ELF','versionOutput':version.decode(),
        'onlyBinaryExtracted':True,'globalInstallationChanged':False,'scientificCandidateRebuilt':False,
        'newDOMExecuted':False,'scientificCaptureExecuted':False,'performanceAccepted':None,'gateReevaluated':False}
    (evidence/'installation.json').write_bytes(json.dumps(receipt,indent=2).encode()+b'\n')
    print(json.dumps({key:value for key,value in receipt.items() if key != 'archiveInventory'}),flush=True)
