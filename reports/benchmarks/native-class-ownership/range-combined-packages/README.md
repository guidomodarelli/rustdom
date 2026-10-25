# Preparación independiente del candidato combinado

Esta fase conserva controles y dependencias antes de incorporar el candidato.
No activa un estudio, carga DOM, reinstala paquetes ni recompila Rust. El candidato
solo podrá incorporarse desde el artifact Linux/Node24 del run40168321423/SHA7d977513,
seleccionado antes de nuevas mediciones, una vez aprobada su matriz completa.
constants/selection.json registra esa elección; el ID todavía no está fijado.
La parte de materialización del candidato aún está pendiente.

artifact.py autentica el ZIP, lee la calificación, contrasta fuentes/manifests y
enumera los archivos del paquete sin extraerlos ni ejecutarlos. El CLI exige
además un binding independiente de la colección completa. artifact-binding.json
permanece complete=false mientras la matriz siga viva; no acepta un ledger local
recalculado ni sustituye el perfil preseleccionado por otro resultado disponible.
Seis contratos Python pasan en Windows y Linux con el artifact real anterior
12588139466, usado exclusivamente como fixture: su matriz histórica falló y no
califica al candidato nuevo. Las pruebas alteran ZIP/binario/calificación y rutas,
conservan intacto el original y comprueban el rechazo del CLI público.

baselines.cjs reutiliza los lectores actuales de la preparación histórica de
range-collapse. Autentica el archivo8c430f0b, la calificación original y los599pins,
y crea copias físicas independientes de A0/A1/J0/J1, node_modules y baseline-sources.
Los cinco enlaces permitidos son cuatro resoluciones de dependencias y el CLI de
tldts. B no se copia, ejecuta, relabela ni modifica en la preparación original.
El resultado contiene únicamente controles; no es un paquete candidato calificado.

Cada distribución, dependencia, fuente y enlace se contrasta con identidad externa,
no solo con un índice recalculable. El verificador rechaza binarios cambiados aun
recalculando el ledger, así como enlaces simbólicos o hardlinks con bytes idénticos
que harían compartir el archivo físico entre controles.
La procedencia del compilador baseline (commit3d37f899/tagc869f3c0) se conserva
separada del snapshot transportado. El snapshot preparado no tiene directorio Git:
su sourceCommit=null y los errores128 se guardan tal como los informa Git, sin
convertirlos en una copia limpia del compilador. Mantener estas carpetas de datos
fuera de repositorios; verify contrasta también la metadata real del snapshot.

Comandos, en Linux con un destino nuevo/disjunto y parent existente:

```sh
node baselines.cjs --prepare /preparacion-historica-verificada /controles-nuevos
node baselines.cjs --verify /controles-nuevos
RUSTDOM_COMBINED_BASELINE_SOURCE=/preparacion-historica-verificada \
  node --test --test-concurrency=1 baselines.spec.cjs
```

Seis contratos por Node22.12.0/24.14.1 ejercen Git, archivos, binarios y enlaces
reales, sin mocks ni carga del runtime. Cubren el CLI, corrupción con ledger
recalculado, alias simbólicos/físicos, procedencia Git inventada y preservación de entradas/
destinos. Los inputs originales se verifican de nuevo al finalizar las pruebas.
No cambiar el árbol histórico ni sus paquetes para preparar esta fase.

La herramienta conserva solo índices y fingerprints acotados al archivo autenticado;
las copias son síncronas, no mantiene caches ni abre recursos DOM/N-API. Los directorios
propios de pruebas se limpian tras comprobar su ruta resuelta. No se midió memoria
pico ni se afirma ausencia universal de fugas. No aporta nueva cobertura de memoria
DOM, cuyos probes del candidato se conservan por separado.

El runtime sigue híbrido, no integrado ni aceptado en rendimiento. Las muestras y
rechazos históricos permanecen intactos. El protocolo de una futura captura todavía
debe fijarse/revisarse; la autorización permanente ya cubre esa preparación. Sin tag
ni merge mientras el rendimiento de ownership no esté aceptado.
