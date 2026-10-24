# Preparación XML y regresión del productor de ownership

El commit probado es `385072cce0f292458ecbb03fc9efb6b0a2d719fa`.
GitHub terminó ambos workflows con `success`:

- [Preparación XML](https://github.com/guidomodarelli/rustdom/actions/runs/39886057332): 455 tests XML públicos/nativos y 12 contratos por Node 22.12.0 y 24.14.1.
- [Regresión de ownership](https://github.com/guidomodarelli/rustdom/actions/runs/39886057190): 14 contratos actuales y 17 históricos por cada versión.

Ninguna suite tuvo fallos, cancelaciones, skips o pendientes. Los contratos usan
snapshots y paquetes reales, prueban el CLI y su traslado físico; no usan mocks.
La policy XML fija checkpoint066/source993a1e; ownership conserva checkpoint067.
El candidato conserva source0b485 y package.json3c1570. La identidad completa
está en los probes originales y receipt.json. No hay aceptación de rendimiento.

Se conserva íntegro el ZIP oficial XML, con su tar de fuentes, inputs previos y
posteriores, versiones, distribuciones, dependencias, symlinks y logs de build.
Su SHA-256 coincide con `artifacts.json`: d3267d67b442e1728ce33b27b1460d9cb72304c4d7c1d67ed93bc297556980e5.
El job verificó físicamente el archivo completo y su copia trasladada en ambos
Node. No se reextrajo ni ejecutó ese árbol en la máquina de medición activa.

El ZIP también contiene reportes históricos que ya existían en el checkout.
Solo cuatro reportes pertenecen a esta ejecución: capturedAt cae dentro del
paso `Ejercer XML` correspondiente en jobs.json. receipt.json identifica sus
paths, hashes y versión; compatibility/ conserva esos cuatro bytes originales.
Son 179 casos diferenciales de serialización y 75 de iteradores por Node, todos
con expected igual a actual. Son subconjuntos de los 455 tests, no tests extra.
El informe de serialización no declara Node: su atribución usa el intervalo del
paso. El de iteradores además declara explícitamente la versión.

ownership-regression/ conserva metadata, log completo, contratos y probes crudos
del workflow compañero. No duplica su paquete completo: el ZIP oficial quedó
en la cache local y su digest publicado se registra en receipt.json. Esta
evidencia de regresión no reemplaza la preparación oficial anterior del estudio.

Cada workflow ejercitó tres ciclos de DOM por cada copia A0/A1/B/J0/J1 en ambos
Node y observó 15 Window y 15 Document por perfil. Los cuatro perfiles suman
60 observaciones de cada tipo. Todos llegaron a dos endpoints claros antes de
salir. Los probes usan creación, mutación, clonación, Range, evento y close;
no prueban todos los ciclos XML. Las suites XML ejercen sus rutas por separado.
Los contadores de constructores N-API persistentes se comparan con su baseline;
no se afirma que todos los contadores nativos sean cero.

Son controles finitos de liberación; no certifican ausencia universal de fugas,
crecimiento dentro de procesos longevos ni memoria pico. Los valores RSS/heap
crudos se conservan sin interpretarlos como una comparación de rendimiento.

`python3 verify-metadata.py` comprueba los bytes y contratos conservados, sin
cargar DOM o árboles preparados. `python3 verify-selection-regression.py`
acepta los cuatro reportes actuales y rechaza un histórico real fuera del job,
una versión declarada distinta, una atribución a otro paso de Node y un
timestamp distinto del recibo. Son verificaciones de metadata; no se suman a
los 455 tests XML. La revisión cerró el P2 que faltaba en esa atribución.

files.json autentica los inputs crudos y el recibo generado, excluyéndose a sí
mismo y a los documentos de revisión posteriores. No se ejecutó ningún nuevo
benchmark, captura V8 ni suite local. Los gates anteriores mantienen su rechazo;
esta preparación no agrega Rust ni habilita merge o checkpoint.
