"""Preserve exact CI transport, failed and successful contracts, and a complete real input snapshot in bounded ZIP parts."""
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

repo = Path.cwd()
native = Path(r'\\?\UNC\wsl.localhost\Ubuntu-22.04\home\guido\rustdom-validation')
final = native / 'combined-process-capture-ci-20261025-transport-budget-fix'
out = repo / 'reports/validation/combined-process-study/20261025-capture-preparation'
data = repo / 'reports/benchmarks/native-class-ownership/combined-capture-preparation/20261025'
memory = repo / 'reports/memory/combined-process-study/20261025-capture-preparation'
ci_out = repo / 'reports/validation/combined-process-study/40176086547'
for directory in [out, data, memory, ci_out]:
    assert not directory.exists(); directory.mkdir(parents=True)
    (directory / '.gitattributes').write_text('*.json -text\n*.zip -text\n', encoding='utf-8', newline='\n')

def digest(filename):
    result = hashlib.sha256()
    with filename.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1048576), b''):
            result.update(chunk)
    return result.hexdigest()

def dump(filename, value):
    filename.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')

collection_root = repo / '.cache/combined-worker-contract-ci-d149'
collection = json.loads((collection_root / 'collection.json').read_bytes())
assert collection['run'] == 40176086547 and collection['head'] == 'd14941173bf80e354b0935f4a79cea2edcfa1dca'
assert collection['conclusion'] == 'success' and len(collection['results']) == 2
for file in collection_root.rglob('*'):
    if file.is_file():
        target = ci_out / file.relative_to(collection_root); target.parent.mkdir(parents=True, exist_ok=True); shutil.copyfile(file, target)
for name in ['collect-combined-worker-contracts-d149.py', 'collect-combined-worker-contracts-d149-transport.py', 'observe-combined-worker-contracts-d149.py']:
    (ci_out / 'tools').mkdir(exist_ok=True); shutil.copyfile(repo / '.cache' / name, ci_out / 'tools' / name)
dump(ci_out / 'preservation.json', {'files': {file.relative_to(ci_out).as_posix(): {'bytes': file.stat().st_size, 'sha256': digest(file)}
    for file in ci_out.rglob('*') if file.is_file()}, 'sourceHead': collection['head'], 'run': collection['run'], 'attempt': 1,
    'testsPerNode': 17, 'runtimeExecutedByCollector': False, 'archivedCodeExecuted': False})
(ci_out / 'README.md').write_text('''# CI publicado del worker combinado

Run40176086547, intento1, SHA d1494117: terminal success2/2, 17 contratos
por Node22.12.0/24.14.1. Artifacts12592871157/12593255393 conservados íntegros,
con tamaño/digest API, miembros, logs del run y metadata. Se verificaron SDKs,
688 dependencias/599 pins, derivación y extracción del paquete5b67fcc6.
El contrato de manifiesto inválido entra al worker y conserva el fallo sin
workloads. El lector de transporte no ejecuta DOM ni código archivado.
Esta evidencia corresponde a d149, no al capturador nuevo aún deshabilitado.
''', encoding='utf-8', newline='\n')

entries = {}
def add_tree(prefix, directory):
    for file in directory.rglob('*'):
        if file.is_file() and '__pycache__' not in file.parts and file.suffix != '.pyc':
            entries[prefix + '/' + file.relative_to(directory).as_posix()] = file

method = 'reports/benchmarks/native-class-ownership/combined-process-study'
for label, dirname in [('initial-sdk-bound-failure', 'combined-process-capture-ci-20261025'),
                       ('binary-reader-fixed', 'combined-process-capture-ci-20261025-binary-fix'),
                       ('final-transport-budget-fixed', 'combined-process-capture-ci-20261025-transport-budget-fix')]:
    root = native / dirname
    add_tree(label + '/proof', root / 'proof'); add_tree(label + '/method', root / 'source' / method)
    for workflow in ['combined-process-study-contracts.yml', 'ownership-combined-process-study.yml']:
        entries[label + '/' + workflow] = root / 'source/.github/workflows' / workflow
    for node in ['node22', 'node24']:
        directory = root / (node + '-derived')
        if directory.exists(): add_tree(label + '/' + node + '-derived', directory)
add_tree('current-source/method', repo / method)
for workflow in ['combined-process-study-contracts.yml', 'ownership-combined-process-study.yml']:
    entries['current-source/' + workflow] = repo / '.github/workflows' / workflow
for name in ['make-combined-capture-ci-helper.py', 'reproduce-combined-capture-ci-linux.py',
             'reproduce-combined-capture-ci-binary-fix-linux.py', 'reproduce-combined-capture-ci-budget-fix-linux.py',
             'prepare-combined-capture-inputs.cjs', 'preserve-combined-capture.py']:
    entries['tools/' + name] = repo / '.cache' / name
for name in ['preflight.json', 'preparation-inventory.json', 'preparation-result.json']:
    entries['preparation/' + name] = final / name
commands = json.loads((final / 'proof/commands.json').read_bytes())
assert len(commands) == 11 and all(command['exitCode'] == 0 for command in commands)
for node in ['node22', 'node24']:
    log = (final / ('proof/' + node + '-tests.stdout.log')).read_text(encoding='utf-8')
    assert ('# tests 29' in log and '# pass 29' in log) or ('ℹ tests 29' in log and 'ℹ pass 29' in log)
qa = out / 'qa.zip'
with zipfile.ZipFile(qa, 'x', zipfile.ZIP_DEFLATED, compresslevel=6) as output:
    for name, file in sorted(entries.items()): output.write(file, name)
with zipfile.ZipFile(qa) as source:
    assert source.testzip() is None
    members = {name: {'bytes': len(source.read(name)), 'sha256': hashlib.sha256(source.read(name)).hexdigest()} for name in entries}
dump(out / 'qa.json', {'bytes': qa.stat().st_size, 'sha256': digest(qa), 'members': len(entries), 'files': members})

snapshot = final / 'preparation-proof'
files = sorted(file for file in snapshot.rglob('*') if file.is_file())
part_limit = 33554432; parts = []; member_manifest = {}; groups = []; group = []; size = 0
for file in files:
    length = file.stat().st_size; assert length <= part_limit
    if group and size + length > part_limit: groups.append(group); group = []; size = 0
    group.append(file); size += length
if group: groups.append(group)
for ordinal, group in enumerate(groups, 1):
    archive = data / f'preparation-part-{ordinal:03}.zip'
    with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED, compresslevel=6) as output:
        for file in group: output.write(file, file.relative_to(snapshot).as_posix())
    with zipfile.ZipFile(archive) as source:
        assert source.testzip() is None
        for file in group:
            name = file.relative_to(snapshot).as_posix(); raw = source.read(name)
            assert hashlib.sha256(raw).hexdigest() == digest(file)
            member_manifest[name] = {'archive': archive.name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    parts.append({'path': archive.name, 'bytes': archive.stat().st_size, 'sha256': digest(archive), 'members': len(group)})
    print(json.dumps({'preservedPart': archive.name, 'members': len(group), 'bytes': archive.stat().st_size}), flush=True)
expected_inventory = json.loads((final / 'preparation-inventory.json').read_bytes())
assert {name: {'bytes': identity['bytes'], 'sha256': identity['sha256']} for name, identity in member_manifest.items()} == expected_inventory['files'], 'Preservation must cover the complete independently recorded Linux inventory'
dump(data / 'manifest.json', {'purpose': 'preparation-only', 'partRawByteLimit': part_limit, 'parts': parts,
    'files': member_manifest, 'directories': json.loads((final / 'preparation-inventory.json').read_bytes())['directories'],
    'samplerInvoked': False, 'performanceAccepted': None, 'gateReevaluated': False})
result = json.loads((final / 'preparation-result.json').read_bytes())
assert result['methodFiles'] == 701 and result['harnessFiles'] == 434 and result['samplerInvoked'] is False
dump(memory / 'preparation-snapshots.json', result)
summary = {'sourceHead': 'd14941173bf80e354b0935f4a79cea2edcfa1dca', 'sourceIsExplicitUncommittedOverlay': True,
    'contractsPerNode': 29, 'nodes': ['v22.12.0', 'v24.14.1'], 'ciCommandsPassed': 11,
    'sparseDependencies': 700, 'sourceSnapshotFilesIncludingCatalog': 701, 'historicalPins': 599, 'historicalHarnessFiles': 434,
    'existingFunctionalReportsReadPerNode': 64, 'existingMeasuredDurationsRead': 576, 'existingWarmupRead': 192,
    'newMeasurementProcesses': 0, 'failedWorkerContractPerNode': 1, 'descriptorFailureCyclesPerNode': 32,
    'preparationBeforeDescriptors': result['before']['descriptors'], 'preparationAfterDescriptors': result['after']['descriptors'],
    'preparationMembers': len(member_manifest), 'preparationParts': len(parts), 'qaMembers': len(entries),
    'jobTimeoutMinutes': 200, 'captureTimeoutMinutes': 175, 'setupBudgetMinutes': 13, 'archiveTimeoutMinutes': 4,
    'uploadTimeoutMinutes': 3, 'jobOverheadMarginMinutes': 5, 'captureAuthenticated': False, 'performanceAccepted': None,
    'gateReevaluated': False, 'executionReady': False, 'externalTransportPending': True, 'activationReceiptPending': True,
    'scientificPositiveReplayPending': True, 'newStudyActivated': False, 'runtimeHybrid': True, 'foreignEntriesPreserved': 48}
dump(out / 'summary.json', summary)
(out / 'README.md').write_text('''# Preparación de captura y lectura portable

Pasaron29 contratos por SDK y11 comandos de CI reproducido, con fuente Git real
d149 y overlay WIP explícito. Se verificaron700 dependencias/599 pins y701 archivos
del snapshot incluyendo el catálogo. El primer intento detectó que el SDK Node
supera el límite JSON: se conserva el fallo. La corrección verifica el binario
con bloques de1MiB/límite256MiB, manteniendo16MiB por reporte. El segundo intento
aprobó. La revisión halló el riesgo de perder parciales por job180/captura175:
se corrigió prospectivamente job200, setup13+captura175+archivo4+upload3+margen5,
sin modificar presupuestos de regresión ni los workflows históricos.

El intento final aprueba29 tests por Node22/24, actionlint de ambos YAML, preparación
real y snapshots. La lectura portable usa los mismos64 procesos archivados:
no se ejecutan nuevos workloads. Cambiar rutas de transporte conserva íntegros
commits/errores Git y comandos originales. Se rechazan aliases, comandos y
commits alterados, owners supervivientes y promoción de funcional a científico.
Los456 miembros de la derivación funcional anterior se verifican como bytes
con su SHA/HEAD/controles fijados; el modo científico no admite esa excepción.

Una preparación dedicada conservó todos sus archivos y el inventario en
reports/benchmarks/native-class-ownership/combined-capture-preparation/20261025/.
QA conserva fuentes, logs y los tres intentos. No ejecutar código archivado.
CI publicado de d149 aprobado y autenticado en ../40176086547/ corresponde al
hito anterior de17 tests, no a este código nuevo. Falta su CI publicado.

executionReady=false. Capturador y lector de payload están implementados y
probados en preparación, rechazo y lectura de datos reales; no existe una captura
nueva de2048 ni prueba positiva integral de ese estudio. Faltan transporte externo,
recibo de activación revisado y checks del SHA habilitado. captureAuthenticated=false,
performanceAccepted=null. Sin integración/tag/merge de ownership.
''', encoding='utf-8', newline='\n')
(data / 'README.md').write_text('''# Snapshot real de preparación, sin mediciones

Todas las partes y miembros están en manifest.json, con bytes y SHA256.
Cada ZIP contiene archivos completos; no se corta ni omite un archivo. Los
directorios originales se conservan en el manifiesto. El límite por parte
corresponde solo al transporte Git y no cambia filas, muestras o presupuestos.

La fuente real es d149 con overlay WIP explícito; los campos Git permanecen
reales. Incluye701 archivos de método, paquete calificado y derivación de434
fuentes. No importar ni ejecutar código de estas partes: son evidencia para
lectores actuales. No hay muestras nuevas, aceptación ni runtime íntegro Rust.
''', encoding='utf-8', newline='\n')
(memory / 'README.md').write_text('''# Recursos de preparación y lectores

Esta fase no crea Window/Document ni nuevos estados N-API. Relee los64 procesos
funcionales preservados y prepara snapshots con IO finito. Los estimadores
retienen únicamente tuples y vistas compactas, no todos los reportes completos.
El binario SDK se hashea con un buffer reutilizable de1MiB; los JSON se acotan
a16MiB. Los descriptores del hash se cierran también ante error:32 rechazos
por SDK conservaron la cantidad observable de /proc/self/fd en sus contratos.

La preparación dedicada Node22 observó23 descriptores antes y23 después.
Sus snapshots de heap/RSS/external están íntegros en preparation-snapshots.json;
no miden memoria pico ni el uso de los subprocesses. Son observaciones finitas
y no prueban ausencia universal de fugas ni distinguen retención del allocator.
Los ciclos DOM reales previos y baselines siguen en los reportes de calificación.
''', encoding='utf-8', newline='\n')
print(json.dumps({'qaMembers': len(entries), 'qaBytes': qa.stat().st_size, 'preparationMembers': len(member_manifest),
    'parts': len(parts), 'contractsPerNode': 29, 'newMeasurementProcesses': 0}), flush=True)
