"""Preserve reviewed completed CI transport/replay results without moving the qualified source."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

if sys.flags.optimize:
    raise RuntimeError('CI result preservation requires non-optimized Python')

source = Path(__file__).resolve().parent.parent
data = Path('C:/Users/guido/.codex/worktrees/pilot-v2-ci-evidence/rustdom')
linux_root = Path('\\\\wsl.localhost\\Rustdom-Validation-20261025\\run')
collection = linux_root/'rustdom-ci-4196-artifacts-20261026'
replay = linux_root/'rustdom-ci-4196-replay-20261026'
analysis = linux_root/'rustdom-ci-4196-analysis-20261026'
publication = source/'.cache/ci-4196-bounded-publication'
git = ['git','-c','core.longpaths=true','-c','gc.auto=0','-c','maintenance.auto=false']
receipt_raw = (collection/'receipt.json').read_bytes()
replay_raw = (replay/'summary.json').read_bytes()
transport_raw = (publication/'summary.json').read_bytes()
receipt = json.loads(receipt_raw)
replayed = json.loads(replay_raw)
transport = json.loads(transport_raw)
assert receipt['allFourteenArtifactsAuthenticated'] and replayed['allFourteenArtifactsMaterialized']
assert len(replayed['replays']) == 8 and transport['allFourteenOriginalArchivesRoundTripped']
assert transport['collectionReceiptSha256'] == hashlib.sha256(receipt_raw).hexdigest()
assert transport['originalArchiveBytes'] == receipt['archiveBytes'] == 234895282
assert hashlib.sha256(receipt_raw).hexdigest() == '2a1534ae06451a318133c67bdfa025798663bf72fb53284c4d46b3ef2a84b089'
assert hashlib.sha256(replay_raw).hexdigest() == 'e64bc633827582b8e46bae91c3dd23ee1383106e7789bf842825948cb06fc459'
assert subprocess.check_output(git+['rev-parse','HEAD'],cwd=data).decode().strip() == transport['finalEvidenceCommit']
assert subprocess.check_output(git+['status','--porcelain'],cwd=data) == b''
base = Path('reports/validation/jsdom-block-pilot-v2/ci-4196c496')
owned = []
files = {}
redactions = []


def write(relative,raw,replace=False):
    assert len(relative.as_posix().encode()) <= 219, relative
    target = data/relative
    assert replace or not target.exists(), relative
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(raw)
    path = relative.as_posix()
    owned.append(path)
    files[path] = hashlib.sha256(raw).hexdigest()


def copy(filename,relative):
    raw = filename.read_bytes()
    if filename.name == 'writer-identity.stdout':
        redactions.append({'path':relative.as_posix(),'reason':'Se omite la consulta de nombre/email; la identidad real permanece en la metadata de los commits públicos.'})
        raw = b'Author lookup output omitted from public logs. See the corresponding published Git commit metadata.\n'
    write(relative,raw)


zip_paths = {record['originalPath'] for record in receipt['artifacts']}
for filename in sorted(collection.rglob('*')):
    if filename.is_file() and filename.relative_to(collection).as_posix() not in zip_paths:
        copy(filename,base/'collection'/filename.relative_to(collection))
for filename in sorted(publication.rglob('*')):
    if filename.is_file():
        copy(filename,base/'transport'/filename.relative_to(publication))
for filename in sorted(replay.rglob('*')):
    if filename.is_file() and (filename.parent == replay or filename.parent == replay/'journals'):
        copy(filename,base/'offline-replay'/filename.relative_to(replay))
for folder,alias in [('rustdom-ci-4196-reader-tests-20261026','initial-reader'),
                     ('rustdom-ci-4196-entry-guards-20261026','initial-entry'),
                     ('rustdom-ci-4196-reader-tests-pinned-20261026','pinned-reader'),
                     ('rustdom-ci-4196-entry-guards-pinned-20261026','pinned-entry')]:
    for filename in sorted((linux_root/folder).rglob('*')):
        if filename.is_file():
            copy(filename,base/'reader-tests'/alias/filename.relative_to(linux_root/folder))
for filename in ['collect-ci-4196-bounded.py','publish-ci-4196-bounded.py','replay-ci-4196-offline.py',
                 'test-collect-ci-4196.py','test-ci-4196-entry-guards.py','analyze-ci-4196-recorded.py',
                 'preserve-ci-4196-results.py','test-preserve-ci-4196-guards.py','ci-4196-collection-method-review.json']:
    copy(source/'.cache'/filename,base/'readers-as-run'/filename)
for folder,alias in [('ci-4196-preservation-guard-tests','preservation-initial'),
                     ('ci-4196-preservation-guard-tests-final','preservation-final')]:
    for filename in sorted((source/'.cache'/folder).rglob('*')):
        if filename.is_file():
            copy(filename,base/'reader-tests'/alias/filename.relative_to(source/'.cache'/folder))
benchmark_root = Path('reports/benchmarks/ci-general/40395416750')
write(benchmark_root/'.gitattributes',b'* -text -whitespace\n')
copy(analysis/'benchmark-analysis.json',benchmark_root/'analysis.json')
copy(analysis/'all-main-comparisons.csv',benchmark_root/'all-main-comparisons.csv')
memory_root = Path('reports/memory/ci-general/40395416750')
write(memory_root/'.gitattributes',b'* -text -whitespace\n')
copy(analysis/'native-memory-analysis.json',memory_root/'native-memcheck.json')
copy(analysis/'functional-endpoints.json',memory_root/'functional-jsdom-endpoints.json')
qualification = json.loads((data/base/'qualification-status.json').read_bytes())
qualification['completeCiArtifactsAuthenticatedHere'] = True
qualification['completeCiArtifactsAuthenticatedHereCount'] = 14
qualification['completeCiArtifactsRemoteReadbackVerified'] = True
for role,count in [('contracts',4),('general',10)]:
    qualification['qualification'][role]['artifactsDownloadedInThisCollection'] = True
    qualification['qualification'][role]['authenticatedArtifactCount'] = count
qualification['offlineReplaysPassed'] = 8
qualification['fullFunctionalCiTransportQualified'] = True
qualification['scientificCapturePreservationQualified'] = False
qualification['scientificTransportRemaining'] = 'Integrar el lector de captura de32artifacts y la publicación secuencial por criterio; este QA fijado a14artifacts/256MiB no se ejecuta como colector científico.'
write(base/'qualification-status.json',json.dumps(qualification,indent=2,ensure_ascii=False).encode()+b'\n',replace=True)
summary = {'sourceCommit':receipt['sourceCommit'],'originalArchiveBytes':receipt['archiveBytes'],
    'artifacts':14,'allOriginalZipPartsIndependentlyReadBack':True,'offlineReplaysPassed':8,
    'uniqueFunctionalCriteria':4,'uniqueFunctionalProcesses':128,'replayedTwiceNotNewSamples':True,
    'readerGuardCasesPassed':17,'isolatedMethodReviewActionableFindings':0,
    'preservationOptimizedInterpreterGuardCasesPassed':2,
    'isolatedResultReviewActionableFindings':0,'transportFinalEvidenceCommit':transport['finalEvidenceCommit'],
    'collectionReceiptSha256':hashlib.sha256(receipt_raw).hexdigest(),'replaySummarySha256':hashlib.sha256(replay_raw).hexdigest(),
    'transportSummarySha256':hashlib.sha256(transport_raw).hexdigest(),
    'fullFunctionalCiTransportQualified':True,'scientificCapturePreservationQualified':False,
    'newDOMExecuted':False,'scientificCaptureExecuted':False,'performanceAccepted':None,'gateReevaluated':False}
write(base/'completed-artifacts-summary.json',json.dumps(summary,indent=2).encode()+b'\n')
readme = '''# Evidencia actual de CI sobre `4196c496`

Se autenticaron 14 ZIP de contratos40395417183 y general40395416750, intento 1,
234.895.282 bytes. Cada ZIP completo está en `artifacts/<role>/<id>/zip.parts/`;
`transport/summary.json` conserva el orden, tamaño, SHA256 original y de cada
parte, commits y lecturas remotas independientes. Ningún byte del ZIP cambió.
La metadataAPI, logs e inventarios completos están legibles en `collection/`
y también íntegros en `artifacts/collection-metadata.tar.gz.parts/`.

Se materializaron fuera del checkout los 14 ZIP y se verificaron ocho replays
usando código actual revisado de4196 en un Git Linux real y limpio, con Node
22.12.0/24.14.1 fijados. Son cuatro criterios funcionales y 128 procesos únicos:
no sumar una segunda
vez las mismas muestras por el segundo lector. No se ejecutó DOM nuevo ni
código archivado. `readers-as-run/` es auditoría: no ejecutarlo ciegamente.

Los 13 casos del lector y cuatro guards del publicador/replay pasaron. El hallazgo P2
de dependencias transitivas se corrigió antes de la colección. Los primeros
tests también se conservan, sin mezclarlos como muestras nuevas. La revisión
aislada del método y los resultados no encontró hallazgos pendientes.

`reports/benchmarks/ci-general/40395416750/` publica todas las 332 comparaciones:
213 medianas rustdom mayores y 119 menores. Son datos descriptivos ordinarios de
hosts separados; no aceptan ownership. Veinte reportes de contrato adicionales
siguen separados. La fuente real observada es34eb7b9b y Node24.21.0; no se
normalizaron sourceCommit, sourceChanges ni sourceGitErrors a la fuente del PR.

`reports/memory/ci-general/40395416750/` conserva el análisis de 311 tests Rust
en diez batches de Memcheck y los endpoints jsdom. Los límites incluyen V8, addon cargado
y memoria pico no cubiertos. No prueban ausencia universal de fugas.

Este QA completa el transporte funcional actual. Su colector fija 14 artifacts
y 256 MiB; falta integrar el transporte científico por criterio antes de aplicar
la etiqueta v2. Rendimiento histórico sigue rechazado: no tag ni merge.
Runtime híbrido y migración general activa. Mantener 903 entradas y 850 pins.
'''
write(base/'COMPLETED.md',readme.encode('utf-8'))
handoff = data/'reports/progress/HANDOFF.md'
old = handoff.read_bytes()
prefix = '''## CI `4196c496` conservado y reproducido — 2026-10-26 UTC

La fuente `4196c496` mantiene 77/79 checks verdes; los dos rojos de ownership
reproducen el rechazo histórico, no un fallo de checkout. Se publicaron los
14 ZIP actuales íntegros por partes con lectura remota independiente, metadata,
logs e inventarios. Pasaron 14 materializaciones externas y ocho replays en ambos
Node fijados, sin DOM nuevo. Ver `ci-4196c496/COMPLETED.md` y su resumen.

Benchmarks ordinarios: 332 filas, 213 medianas rustdom mayores/119 menores y otros
20 contratos separados. Memcheck: 311 tests Rust en diez batches, con límites explícitos.
La revisión del método/resultados quedó sin hallazgos. Los 17 tests de lectores/guards
pasaron; se preservó también el P2 corregido de dependencias transitivas.

Falta integrar y probar el colector científico secuencial por criterio antes de
aplicar la etiqueta v2: el QA actual fija 14 artifacts/256 MiB y no admite la matriz
de 32 criterios. No ejecutar otra vez los scripts de captura/activación históricos
ni este transporte fijo ya consumido. Mantener la fuente4196 calificada estable.
Autorización permanente vigente; sin preguntas. No tag/merge con rechazo actual.
Runtime híbrido, migración activa y 48 entradas ajenas preservadas.


'''
heading = b'# Continuar rustdom en otra m\xc3\xa1quina\r\n\r\n' if old.startswith(b'# Continuar rustdom en otra m\xc3\xa1quina\r\n') else b'# Continuar rustdom en otra m\xc3\xa1quina\n\n'
assert old.startswith(heading)
write(Path('reports/progress/HANDOFF.md'),heading+prefix.encode('utf-8')+old[len(heading):],replace=True)
assert max(len(path.encode()) for path in owned) <= 219
manifest = {'files':files,'redactions':redactions,'originalZipBytesRedacted':False,
    'sourceGitMetadataNormalized':False,'scientificSamplesChanged':False,'scope':'CI4196 collection, verified bounded publication and offline replay; source branch unchanged.'}
manifest_path = base/'completed-results-preservation.json'
write(manifest_path,json.dumps(manifest,indent=2,ensure_ascii=False).encode()+b'\n')
(source/'.cache/ci-4196-results-owned.json').write_bytes(json.dumps(owned,indent=2).encode()+b'\n')
print(json.dumps({'ownedPaths':len(owned),'manifestFiles':len(files),'transportFinalCommit':transport['finalEvidenceCommit']}))
