# Preparación revisable del diagnóstico AA de Range

Estado: preparación, agenda, colector y replay implementados; **captura deshabilitada**.
No se aplicó una etiqueta ni se ejecutaron DOM, samplers o profiling nuevos.
El objetivo de migración sigue pendiente; esto no añade APIs Rust completas.

La revisión prospectiva declara 256 procesos sobre las copias AA actuales,
en la fila range-control-1000/1000 y ambos Node/modos. Los parámetros están
en constants/protocol.json. Las cantidades son planificadas, no observadas.
El método no acepta rendimiento ni modifica la secuencia consumida.

Se comprobó la procedencia de los datos anteriores. El hash de fuente A de
profiles/v2 coincide con la referencia actual, pero ese perfil usa otro ELF,
worker y contexto, únicamente Node22. El perfil B también tiene otra fuente.
La traza de compilación posterior es parcial/WSL y MutationRecord/100 es otra
fila. Se conservan los sourceCommit=null y errores Git históricos, sin
rellenarlos. PROTOCOL.md delimita por qué esa evidencia no representa una
observación CPU/GC/JIT de este run y qué pregunta nueva se busca responder.

La preparación autentica los 563 pins antes de cargar el productor actual de
native-mutation-telemetry. Comprueba sus mapas de código registrados antes de
adaptar únicamente el binding de configuración: revisión y fingerprints de
los paquetes. El sampler instrumentado y wrapper de observación conservan
sus bytes. Los dos árboles finales tienen 893 archivos en cada mapa, sin
contar su recibo externo; se preservan referencias anteriores sin ejecutarlas.

Se verificó en un checkout Git Linux real con HEAD0dd82141 y ocho archivos
nuevos sin trackear: ese es el estado real de la preparación, no un commit
integrado ficticio. Los recibos conservan esa lista, el HEAD y errores Git
vacíos observados. Ambos manifiestos usan las 434 fuentes congeladas y el
HEAD real. No se reconstruyeron ni reinstalaron paquetes preparados.

Validación ejecutada:

- Cinco contratos de agenda/procedencia en Node22.12.0 y cinco en Node24.14.1.
- Los planes completos son byteidénticos entre ambos ejecutables autenticados.
- Seis contratos Python3.10 sobre las derivaciones reales CPU/JIT: mapas
  completos, binding inspeccionado en ambos Node, conservación de destino,
  inputs/HEAD inválidos y restauración de configuración scoped del intérprete.
- El wrapper real, en ambos Node/modos, rechaza captureImplemented=false
  antes de observadores o reportes. Las pruebas negativas usan entorno de
  hijo aislado para llegar a ese guard; no simulan un estudio ejecutado.
- git diff --check. No se cambiaron fuentes runtime ni los 563 pins históricos.

La evidencia íntegra está en
reports/validation/native-class-ownership/range-control-telemetry-preparation/20261025/.
Su ZIP es material de inspección; no ejecutar scripts archivados. Para
reproducir, usar las fuentes actuales y un manifiesto nuevo del checkout real:

```sh
node --test reports/benchmarks/native-class-ownership/range-control-telemetry/model.spec.cjs
node reports/benchmarks/native-class-ownership/range-control-telemetry/model.cjs
python3 -B reports/benchmarks/native-class-ownership/range-control-telemetry/prepare.py /checkout /manifest-real.json /destino-nuevo cpu
```

El colector/replay nuevo autentica mapas independientes, conserva argv y
root originales, valida los checks recientes y todo el historial antes de
ejecutar. Un recibo exclusivo por run impide reiniciar en otro destino.
Los datos históricos usados para probar el lector mantienen identidad y
fila originales; no constituyen observaciones de Range ni una captura nueva.

Faltan revisión/CI completos y registro final de los mapas con la
capacidad habilitada antes de capturar. La autorización permanente ya cubre esos pasos. No
pedir permiso adicional ni activar métodos antiguos. No tag/merge de ownership.
Recursos y límites en reports/memory/range-control-telemetry-preparation-20261025.md.

## Validación de colector y replay

La etapa posterior está en
reports/validation/native-class-ownership/range-control-telemetry-components/20261025/.
Conserva cuatro snapshots locales de QA sobre la base254d0e9f. El final es
955f3beb, un commit privado real y limpio; no es un SHA publicado o compilado
de rustdom. Los snapshots anteriores y las correcciones de entorno permanecen
en el ZIP. Solo esos commits privados de QA usaron signing deshabilitado por
invocación; la configuración de publicación no cambió.

Pasaron 17 contratos por Node22.12.0/24.14.1 y seis Python. Los planes y
preflights son byteidénticos. El grafo tiene590archivos, incluidos los563pins
y su recibo independiente, y los mapas derivados mantienen893por modo.
Las baterías preliminares16/16/17 se solapan y no se suman al conteo final.
La última centralizó rutas y etapas en el protocolo sin cambiar sus valores;
qa-final.zip conserva ese estado y qa.zip mantiene las tres anteriores.

El lector comparó ocho procesos auténticos de40051899308 (ambos Node/modos/
motores), con96spans y hashes completos. Esos datos siguen siendo MutationRecord,
con revisión/identidad originales: la validación de Range los rechaza como
captura nueva. No se prueba un replay positivo de un run nuevo que todavía
no existe. Las fixtures de headers y eventos solo ejercitan guards de metadata;
no se presentan como observaciones o ejecuciones reales.

Se probaron preservación de argv/root, mapas/archivos extra, recibos reescritos,
consumo exclusivo, checks recientes, historial, run vivo, budgets antes/después
del trabajo y formato Git porcelain real. Las guardas siguen cerradas con la
capacidad deshabilitada. La revisión/CI completos continúan pendientes;
no aplicar etiqueta ni ejecutar otro método consumido.

## Integración portable de contratos

`historical-fixtures.py` autentica `fixtures/native-mutation-subset.zip`, su
manifiesto y el índice original publicado. Contiene 57 archivos originales de
ocho procesos de MutationRecord/100, con ambos Node, modos y motores. El índice
sigue describiendo los 512 procesos históricos; no presenta el subconjunto como
un estudio completo ni lo renombra como Range. La extracción lee bloques de
1 MiB, conserva destinos existentes y nunca ejecuta scripts archivados.

`qualify.py` usa Git real limpio, autentica ambos ejecutables fijados, extrae
la preparación exacta publicada sin instalar o recompilar y genera derivaciones
CPU/JIT nuevas sin ejecutar DOM. Conserva argv, logs y errores de cada comando;
compara planes/preflights byte a byte entre Node y verifica que los contratos
restauren el checkout. Usa el probe trackeado propio en fixtures/.

Los workflows nuevos son `range-control-telemetry-contracts.yml` y
`range-control-telemetry.yml`. Los dos checks offline ejecutan lectores y
contratos con timeout de 20 minutos. La futura captura exige seis checks del
SHA exacto y conserva los límites de 55 minutos de captura, 65 de step,
90 de job, 15 de archivo y 10 de subida. El segundo workflow solo responde a
su etiqueta específica/intento 1; mantiene la capacidad deshabilitada en esta
etapa. La autorización permanente ya está concedida.

Reproducir con fuentes actuales en un checkout Git Linux real limpio, salida
nueva disjunta y ambos ejecutables originales autenticados:

```sh
python3 -B reports/benchmarks/native-class-ownership/range-control-telemetry/qualify.py /checkout /salida-nueva /node22/bin/node /node24/bin/node
```

El transporte portable y los workflows no aceptan rendimiento ni reemplazan
los estudios consumidos. Falta habilitar capacidad con mapas/revisión íntegros
y CI del SHA final antes de una única activación nueva.

La evidencia ejecutada está en
reports/validation/native-class-ownership/range-control-telemetry-portable/20261025/:
grafo599, 17 contratos por Node, seis Python de derivación y seis del lector
en Linux; Windows pasó cinco y omitió symlinks por WinError1314, cubierto en
Linux. Actionlint aprobó ambos workflows. El ZIP de QA conserva2424miembros,
fuentes/comandos/logs/derivaciones, y referencia los inputs originales ya
versionados sin duplicarlos. QAprivadaLinux cfa6f167 es real/limpia sobre7b6fca9d;
no es un SHA publicado ni un runtime nuevo. No hubo DOM ni profiling nuevo.
