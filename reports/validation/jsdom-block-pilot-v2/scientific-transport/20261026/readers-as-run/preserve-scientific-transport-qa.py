"""Preserve current transport components, complete finite QA and failures without duplicating committed originals."""
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile

if sys.flags.optimize:
    raise RuntimeError('Scientific transport preservation requires non-optimized Python')
source = Path(__file__).resolve().parent.parent
data = Path('C:/Users/guido/.codex/worktrees/pilot-v2-ci-evidence/rustdom')
base = Path('reports/validation/jsdom-block-pilot-v2/scientific-transport/20261026')
git = ['git','-c','core.longpaths=true','-c','gc.auto=0','-c','maintenance.auto=false']
if subprocess.check_output(git+['rev-parse','HEAD'],cwd=data).strip() != b'c25901a6af14062cc213791addc4a16200af9e15':
    raise ValueError('Published QA branch head changed')
if (data/base/'preservation.json').exists():
    raise FileExistsError('Current transport result preservation already exists')
raw = subprocess.check_output(['wsl','-d','Rustdom-Validation-20261025','-u','root','--','env',
    'PYTHONDONTWRITEBYTECODE=1','python3','/mnt/c/Users/guido/.codex/worktrees/native-class-ownership/rustdom/.cache/export-scientific-transport-qa.py'],timeout=90)
(source/'.cache/scientific-transport-export.tar.gz').write_bytes(raw)
owned = []
files = {}


def write(relative,content):
    name = relative.as_posix()
    if len(name.encode()) > 219 or name in owned:
        raise ValueError('Evidence path too long or duplicated: '+name)
    filename = data/relative
    if filename.exists():
        raise FileExistsError('Evidence already exists: '+name)
    filename.parent.mkdir(parents=True,exist_ok=True)
    with filename.open('xb') as output:
        output.write(content)
    owned.append(name)
    files[name] = hashlib.sha256(content).hexdigest()


write(base/'.gitattributes',b'* -text -whitespace\n')
with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as archive:
    for member in archive.getmembers():
        relative = Path(member.name)
        if not member.isfile() or relative.is_absolute() or '..' in relative.parts or '\\' in member.name:
            raise ValueError('Unexpected transport QA export member')
        write(base/'evidence'/relative,archive.extractfile(member).read())
collection_raw = (data/base/'evidence/collection/summary.json').read_bytes()
publication_raw = (data/base/'evidence/publication/summary.json').read_bytes()
if hashlib.sha256(collection_raw).hexdigest() != '2c2d78b9921923b0363673d2c7ef67055cbd9914fd96fc9a82920390b1fb2f34':
    raise ValueError('Reviewed 33-artifact collection changed')
if hashlib.sha256(publication_raw).hexdigest() != '79dae5a98d096617d0858eb776c68575c77ecc1913aa21884c682b40175cfea6':
    raise ValueError('Reviewed native publisher result changed')
collection = json.loads(collection_raw)
publication = json.loads(publication_raw)
if collection['originalArchivesAuthenticated'] != 33 or collection['offlinePartialReplays'] != 64 or collection['originalArchiveBytes'] != 408198146:
    raise ValueError('Complete prior-failure transport matrix differs')
if publication['parts'] != 4 or publication['record']['bytes'] != 111209731 or not publication['record']['wholeRemoteDigestVerified']:
    raise ValueError('Native publication matrix differs')
boundaries = json.loads((data/base/'evidence/boundaries-current/summary.json').read_bytes())
if len(boundaries['cases']) != 31 or not all(case['passed'] for case in boundaries['cases']):
    raise ValueError('Current metadata/ZIP boundaries did not all pass')
for directory in ['scientific-collection-reviewed-code','scientific-collection-reviewed-code-v2']:
    origin = source/'.cache'/directory
    for filename in sorted(origin.rglob('*')):
        if filename.is_file():
            write(base/'readers-as-run'/directory/filename.relative_to(origin),filename.read_bytes())
for filename in ['export-scientific-transport-qa.py','preserve-scientific-transport-qa.py','import-native-qa-parts.py']:
    write(base/'readers-as-run'/filename,(source/'.cache'/filename).read_bytes())
for filename in ['native-qa-part-import.json','shared-fetch-recovery.json']:
    write(base/'recovery'/filename,(source/'.cache'/filename).read_bytes())
new_tools = ['artifacts.py','publish.py','loader.py','constants/artifacts.json','constants/loader.json',
    'tests/test_artifacts.py','tests/test_loader.py']
for name in new_tools:
    relative = Path('tools/evidence-transport')/name
    owned.append(relative.as_posix())
    files[relative.as_posix()] = hashlib.sha256((data/relative).read_bytes()).hexdigest()
for name,checksum in collection['maintainedCodeSha256'].items():
    if hashlib.sha256((data/'tools/evidence-transport'/name).read_bytes()).hexdigest() != checksum:
        raise ValueError('Actual transport code changed after its complete collection: '+name)
if hashlib.sha256((data/'tools/evidence-transport/publish.py').read_bytes()).hexdigest() != publication['publisherSha256']:
    raise ValueError('Actual publisher changed after its remote roundtrip')
processes = {}
for role in ['collection','publication','collection-initial-failure']:
    directory = data/base/'evidence'/role/'journals'
    records = [json.loads(filename.read_bytes()) for filename in directory.rglob('*')
        if filename.is_file() and (filename.name.endswith('.process.json') or filename.name == 'process.json')]
    if not records or any(record['subtree']['ownedDescendantsRemaining'] for record in records):
        raise ValueError('Native command subprocess closure is incomplete: '+role)
    processes[role] = {'journals':len(records),'exitCodes':{str(code):sum(record['exitCode'] == code for record in records)
        for code in sorted({record['exitCode'] for record in records})},'ownedLinuxDescendantsRemaining':[]}
review = {'reviewer':'review_ownership_closeout','readOnly':True,'actionableFindings':0,
    'collectionSummarySha256':hashlib.sha256(collection_raw).hexdigest(),
    'publicationSummarySha256':hashlib.sha256(publication_raw).hexdigest(),
    'correctedFindings':['P2: proteger source/ancestros antes de extraer ZIP',
        'P2: autenticar y compilar bytes/policies/lock antes de imports; ignorar cache válido'],
    'scope':'Componentes y QA de transporte/replay parcial; no acredita captura/replay científico completo ni aceptación Rust.'}
write(base/'review.json',json.dumps(review,indent=2,ensure_ascii=False).encode()+b'\n')
resources = {'scope':'Finite native Linux evidence transport, not Rust DOM or V8 peak memory.',
    'commandProcessReceipts':processes,'collectedOriginalArchives':33,'collectedOriginalArchiveBytes':408198146,
    'offlinePartialReplays':64,'boundedPublicationParts':4,'originalPublicationBytes':111209731,
    'independentlyVerifiedDisposableGitRepositoriesRemoved':8,
    'maximumObservedDisposableRepositoryPairBytes':max(part['publisherRepositoryBytes']+part['readerRepositoryBytes'] for part in publication['record']['parts']),
    'repositorySizeIsNotRssOrPeakMemory':True,'credentialsPersisted':False,
    'windowsCredentialBridgeClosureProven':False,'universalLeakAbsenceProven':False,
    'newDOMExecuted':False,'scientificCaptureExecuted':False,'performanceAccepted':None,'gateReevaluated':False,
    'sharedWindowsFetchFailedOutOfDisk':True,'sharedFetchTemporaryBufferBytesRetained':467795968,
    'temporaryCleanupRejectedAndNotRetried':True,'committedWorkingCopiesUnmaterializedBytes':812492330,
    'permanentGitObjectsDeleted':False,'onlyFourVerifiedBlobsImportedWithoutAnotherFetch':True}
write(Path('reports/memory/git-evidence-transport/20261026/scientific-components.json'),json.dumps(resources,indent=2).encode()+b'\n')
readme = '''# Componentes nativos del transporte científico

El receptor actual autenticó los33ZIP del intento consumido40366685759:
408198146bytes, metadata API y33logs íntegros. Los64replays con Node22.12.0 y
24.14.1 conservan complete=false, reason=no-index y analysis=null. El lector
ejecuta código actual revisado; no ejecuta código archivado ni workers DOM.
Esto reproduce el fallo histórico de preparación y no completa sus muestras.
El source real del lector permanece4196c496; la captura antigua dice1078e4fd.
No se normalizaron ni falsearon esas procedencias distintas.

La publicación nativa del ZIP existente111209731bytes (artifact12688150146,
run40395417183, intento1) produjo cuatro partes de32MiB o menos, lectura remota
independiente y hash conjunto idéntico. Los ocho Git descartables se retiraron
solo después de confirmar su publicación. Commit final de esas partes:
c25901a6af14062cc213791addc4a16200af9e15. No reintentos de mutaciones inciertas.
Sus bytes siguen bajo roundtrip/; esta preservación no los vuelve a stagear.

Pasaron31pruebas reales de metadata/ZIP y seis controles de carga. Se cerraron
dos P2: destinos dentro/encima del source y uso de bytecode cacheado distinto
del source autenticado. El loader verifica siete pins (incluidos policies y
lock) antes de compilar los mismos buffers; una fixture .pyc válida e inocua
demuestra que el import estándar ejecutaría el reemplazo y el loader lo ignora.
La fixture cacheada se archiva como .bin, solo datos. No es un mock de SDK.

El primer lector falló antes del primer ZIP porque gh2.103.3 rechazó ANSI de
un log. El fix agrega --allow-escape-sequences únicamente al GET de logs;
stdout siempre va a archivos supervisados y nunca se muestra en la terminal.
La raíz fallida y sus fuentes congeladas se conservan. El primer intento de
tests de metadata usó .cache sin sus ZIP ya retirados; el posterior usa los
originales publicados. No se presenta ese intento incompleto como prueba pasada.

Un fetch filtrado en el Git compartido Windows intentó repack de vínculos
locales y llenó C:. La revisión automática bloqueó borrar tmp_pack_IyiPK4;
sigue intacto y no se reintentó. Se recuperó espacio con sparse checkout de
65copias limpias versionadas (812492330bytes), verificadas en SHA256 y Gitblob,
sin intersección con903entradas del método. Los originales siguen en Git/remoto.
Los cuatro blobs QA se importaron de forma acotada y verificada sin otro fetch;
los dos flags transitorios de origin se restauraron. No se borró ningún pack
permanente ni objeto Git. El directorio tools/evidence-transport queda incluido
en el sparse de la rama de datos para conservar sus módulos físicos.

evidence/export-inventory.json referencia por tamaño/SHA/Gitblob los ZIP/tar
duplicados que ya están íntegros en4196. Los demás journals, resultados,
parciales, fuentes y controles se guardan byte por byte. source-invariants.json
vuelve a verificar902fuentes,903bindings de publicación y850pins históricos;
autentica el recibo por separado. readers-as-run es
auditoría; para operar usar código actual revisado, nunca programas archivados.

Esta evidencia califica componentes y el transporte de una campaña fallida.
Falta conectar/probar el coordinador secuencial de colección, publicación y
replay completo por criterio para la captura v2; no afirmar que ya está listo.
No se aplicó etiqueta ni se ejecutó captura nueva. El CI sigue77/79; ownership
mantiene el rechazo histórico. No acepta rendimiento Rust ni mide memoria pico
del DOM o ausencia universal de fugas. Sin tag ni merge. Runtime híbrido y
migración general pendiente; conservar48entradas ajenas y autorización permanente.
'''
write(base/'README.md',readme.encode('utf-8'))
handoff = data/'reports/progress/HANDOFF.md'
old = handoff.read_bytes()
separator = b'\r\n\r\n' if b'\r\n' in old[:100] else b'\n\n'
position = old.index(separator)+len(separator)
prefix = '''## Componentes de transporte probados sobre33artifacts — 2026-10-26 UTC

Se autenticaron33ZIP/408198146bytes del v1 consumido y64replays parciales en
ambosNode, sin DOM ni nuevas muestras. La publicación nativa del ZIP111MB hizo
cuatro partes con lecturas remotas y retiró ocho Git descartables confirmados.
Sus partes están en el commitc25901a6; resultados en scientific-transport/20261026/.
Pasaron31casos de metadata/ZIP y seis controles de carga autenticada sin .pyc.
Se conservan el fallo ANSI inicial y los P2 cerrados, sin ocultar límites.

Recuperación: el fetch filtrado compartido falló por repack/ENOSPACE. Su temporal
467795968bytes permanece intacto porque borrar fue bloqueado por política; no
reintentarlo. Se unmaterializaron mediante sparse65copias versionadas verificadas,
sin afectar903entradas/850pins; originales Git/remoto conservados. No repetir
fetch filtrado de refs en el Git compartido. DATA tiene tools/evidence-transport
incluido en su sparse y solo se importaron cuatro blobs QA de forma acotada.

Siguiente: conectar/probar el coordinador secuencial para colección+publicación+
replay por criterio y retiro seguro de duplicados confirmados. Los componentes
por separado todavía no califican ese flujo. Luego comprobar SHA/CI/ventana y
la única activación v2 autorizada. Fuente4196 y CI77/79: ownership sigue rechazado.
Sin tag/merge, sin otra pregunta. Runtime híbrido, objetivo activo y48entradas ajenas.


'''
handoff.write_bytes(old[:position]+prefix.encode('utf-8')+old[position:])
owned.append('reports/progress/HANDOFF.md')
files['reports/progress/HANDOFF.md'] = hashlib.sha256(handoff.read_bytes()).hexdigest()
write(base/'preservation.json',json.dumps({'files':files,'exportTarSha256':hashlib.sha256(raw).hexdigest(),
    'existingRoundtripPartsCommit':'c25901a6af14062cc213791addc4a16200af9e15',
    'coordinatorIntegrationQualified':False,'newDOMExecuted':False,'performanceAccepted':None,'gateReevaluated':False},indent=2).encode()+b'\n')
(source/'.cache/scientific-transport-owned.json').write_bytes(json.dumps(owned,indent=2).encode()+b'\n')
print(json.dumps({'ownedPaths':len(owned),'preservationSha256':hashlib.sha256((data/base/'preservation.json').read_bytes()).hexdigest()}))
