# Ownership: estudio original completo, verificado y rechazado

Los 2048 workers completaron exit0 y la verificación original y la de una copia
produjeron exactamente el mismo resultado: `verified=true`, `accepted=false`.
Ambos padres terminaron exit1 por presupuesto. No hay aceptación, tag ni merge
de ownership. Esta evidencia no agrega implementación Rust.

| Node | Workers | Duraciones medidas | Controles jsdom rechazados | Filas Rust fuera del límite numérico |
| --- | ---: | ---: | ---: | ---: |
| 22.12.0 | 1024 | 9216 | 4 | 0 |
| 24.14.1 | 1024 | 9216 | 3 | 0 |

| Node | Fase | Carga | Cambio jsdom (%) | Cambio Rust (%) |
| --- | --- | --- | ---: | ---: |
| 22 | AA | range-control-1000/250 | +3.1312514131 | -0.1223331930 |
| 22 | AB | range-control-1000/1000 | +2.7107127480 | -3.1625944357 |
| 22 | AB | range-state-lifecycle-1000/1000 | -2.7474026406 | -0.9956979548 |
| 22 | AB | range-state-lifecycle-1000/250 | +2.8401337078 | -1.2534506621 |
| 24 | AA | mutation-records-collect/1000 | -2.2221592592 | +1.1419376500 |
| 24 | AB | mutation-records-collect/100 | +4.4938907504 | -1.5191454170 |
| 24 | AB | observer-delivery-records/100 | +2.4843249360 | +3.3886532027 |

Son todos los rechazos. `summary.json` y `receipt.json` conservan las 32 filas
completas; el archivo conserva todas las muestras y los resultados adversos.
Ninguna cifra Rust excede su presupuesto numérico, pero los controles fallidos
impiden usar el estudio para aceptar rendimiento. No se seleccionan filas,
reintentos ni estudios favorables, ni se modifica el estimador o los presupuestos.

## Método e identidades

Método publicado antes de medir en a0346b1355e8751bc560c64e289c2c8f1be55ec2:
415 fuentes, SHA del arnés
7b13cad926da839fc5650dc0d7a49e9e49c1c71af7fdf9192df5359ee6da51df.
Se mantiene una carga por proceso, ocho cargas, fases AA/AB, 16 posiciones,
cuatro factores, semillas 1..16, tres warmups exteriores y nueve muestras por
lote, además del calentamiento del realm actual. Se conservan las mismas
144 muestras por celda, mediana agrupada y presupuestos ±2% jsdom, ±5% Rust AA
y +5% Rust AB. La separación por carga repite arranque, GC inicial y teardown;
no implica igualdad de historia GC/JIT con los métodos anteriores.

El paquete B oficial compilado conserva fuente canónica
0d67e1d821c70371ca1b82817870b7ad6a053f534161ae9096591d7199d0b947;
el arnés mide fuentes canónicas
0b4855490382ab18b7e96851dbdef95e7596268690ae169850daf097498687e9.
No son el mismo identificador. Los cambios canónicos son del arnés de benchmarks,
sin cambios de `src/`, build o dependencias. Los inputs adicionales y su cobertura
se conservan en `build-inputs.json`; la única excepción del manifiesto es
`scripts.test:compat`. `compiled-package.json` conserva los bytes compilados
originales para verificar esa excepción, sin afirmar equivalencia de otro build.

Cada índice conserva versión Node/V8, hardware WSL2, configuración y fechas;
cada worker registra flags, semilla, afinidades y endpoints de memoria. El JIT,
compilación concurrente y GC natural continúan habilitados. El DOM es el motor
híbrido existente, no una implementación íntegra en Rust.

## Archivo íntegro y transporte

El tar original conserva **7429 archivos**, con lectura y hash de cada miembro:
264854969 bytes, SHA-256
a0643d2c1ff7431f0aea1200e66b2a8bd51a9b4059a51e382b2daf277d0e981c.
Se publica en ocho partes de hasta 32 MiB para respetar el límite por archivo de
GitHub. `archive-parts.json` identifica orden, tamaños y hashes individuales y
globales. La concatenación conserva exactamente los mismos bytes; no vuelve a
comprimir, filtrar ni medir el estudio. `raw-files.json` identifica los miembros.

Para reconstruirlo en un directorio nuevo cuyo padre exista, desde la raíz del
repositorio:

```sh
python3 -B reports/benchmarks/native-class-ownership/materialize-recorded-archive.py \
  reports/benchmarks/native-class-ownership/row-isolation-results/2026-10-22 \
  /ruta/nueva/ownership-evidence
```

El materializador verifica cada parte, el tar completo y sus sidecars. Después
se puede extraer con el decoder autenticado en un directorio vacío y ejecutar
el verificador congelado del archivo:

```sh
mkdir /ruta/nueva/ownership-extracted
python3 -B reports/benchmarks/native-class-ownership/recorded-evidence-extract.py \
  /ruta/nueva/ownership-evidence/study.tar.gz \
  /ruta/nueva/ownership-evidence/raw-files.json \
  row-isolation /ruta/nueva/ownership-extracted
node /ruta/nueva/ownership-extracted/row-isolation/study/harness/reports/benchmarks/native-class-ownership/row-isolation-experiment.cjs \
  --verify-set \
  /ruta/nueva/ownership-extracted/row-isolation/study/node-22 \
  /ruta/nueva/ownership-extracted/row-isolation/study/node-24
```

Usar Node22.12.0 o24.14.1 y Python sin `PYTHONOPTIMIZE`. La verificación offline
recalcula fidelidad, completitud, endpoints y presupuestos; no ejecuta DOM ni
repite una captura. `verify-set` devuelve exit0 por integridad con
`accepted=false`; el CLI del gate distingue ese rechazo con exit1.

## Validación y persistencia

Los 28 contratos reales por Node22.12.0/24.14.1 pasaron sin omisiones: 21 del
verificador de archivos completos y siete del transporte. Se conservaron ambos
datasets rechazados, CLI real, cambios de inputs/harness, tars inválidos, bytes
de partes alterados, destinos existentes y guardas Python. No se usaron mocks.
La evidencia está en `reports/validation/native-class-ownership/recorded-evidence/`.

Tras el cierre, WSL apareció detenido y `/tmp` vacío. El archivo y resultados
originales ya estaban guardados en Windows; no se perdieron muestras. Los
recibos temporales de una calificación previa sí se perdieron y no se cuentan
como prueba final. Se recuperaron los mismos datasets, se repitieron únicamente
contratos offline y sus logs finales se escribieron directamente en Windows.
Se conserva también un intento detenido antes de los tests por el nombre
incorrecto del tag del baseline, luego corregido; no fue una nueva medición.

## Diagnóstico y límites

El diagnóstico adicional conserva las 128 celdas y autentica los 2051 archivos
que consume contra los miembros del archivo. Las máscaras de fondo incluyen
CPU2, donde está fijado el hilo principal, en los 2048 workers observados; no se
observan nuevos IDs de hilo al final. Son observaciones de extremos: no prueban
qué CPU se usó dentro del temporizador ni causalidad sobre la variación.

La dispersión descriptiva por proceso/paquete no sustituye el gate ni presupone
independencia o estado estable. El [trabajo de Kalibera y Jones](https://kar.kent.ac.uk/33611/)
distingue variación entre ejecuciones e iteraciones; el estudio
[Virtual Machine Warmup Blows Hot and Cold](https://soft-dev.org/pubs/html/barrett_bolz-tereick_killick_mount_tratt__virtual_machine_warmup_blows_hot_and_cold_v6/)
advierte que un número fijo de warmups no garantiza un estado estable.
Estas referencias orientan el análisis; no explican por sí solas estos resultados.

La evidencia finita de memoria se publica por separado. Los gates de ownership
y XMLSerializer todavía fijan evidencia anterior incompatible; este archivo
rechazado no debe convertirse en un resultado verde cambiando únicamente pins.
