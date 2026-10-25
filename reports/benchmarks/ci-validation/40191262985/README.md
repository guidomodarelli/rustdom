# Benchmarks ordinarios del CI sobre d265390e

Los cuatro shards y su agregador aprobaron en el run 40191262985, intento 1.
Se conservan las 332 filas, 11.952 duraciones medidas y 11.952 snapshots de memoria
del grupo completo, con hashes de output coincidentes entre engines. Hay 18 muestras
por engine y fila: dos procesos por engine, nueve mediciones por proceso. Cada worker
recorre múltiples workloads; no es el diseño de procesos independientes del estudio
científico de ownership.

La mediana de rustdom fue mayor en 215 filas y menor en 117. Estos conteos no son un
índice agregado de rendimiento y no estiman esfuerzo ni migración. comparisons.csv y
comparisons.md muestran todas las filas, favorables y desfavorables. El cociente es
mediana jsdom / mediana rustdom: menos de 1 significa que rustdom tardó más en esta
corrida. La columna rows conserva el parámetro original de cada workload; no tiene
una unidad DOM uniforme entre tareas. Las medianas, mínimos, máximos y cocientes se comprobaron contra las muestras
originales; no se añaden intervalos, filtros ni decisiones estadísticas nuevas.
La tabla Markdown redondea a seis cifras significativas; CSV/JSON conservan la
precisión original. Los conteos usan esos valores completos, incluso diferencias
cercanas a 1 que no establecen significancia estadística.

La fuente observada fue f0904eb9017a46561db4c0ec574e3b75e98219a6, el merge generado
por GitHub. La API confirma d265390e como padre y el mismo árbol Git
3f691e585872ddb5bfc8324f2f5840fe3a7fe0e3. Se preserva la identidad original, sin
reemplazarla por el HEAD del PR. Se ejecutó Node 24.21.0, jsdom independiente 27.4.0
y rustc 1.99.1 sobre Linux x64; cada perfil conserva máquina, toolchain, entradas y
metodología originales. El ELF del runtime híbrido fue 221d5b65…; no es el candidato
congelado 567f6bff… del estudio científico, ni se lo utiliza como sustituto.

El tiempo mide operaciones públicas con sus bindings y cruces nativos; excluye
startup, setup, validación, cierre y GC, según la metodología conservada en los perfiles.
No equivale a medir suites completas ni a ejecutar todo el DOM en Rust. Algunas
rutas mantienen JavaScript y compatibilidad; no se atribuyen causalmente las
diferencias observadas al lenguaje o a un cambio específico.

transport/ conserva el snapshot original del colector con ZIP, metadata API,
manifiestos y logs disponibles cuando terminó el grupo de benchmarks. Contiene
también veinte reportes de contratos del runner, incluidos ocho `failed` deliberados
por workload desconocido o timeout de 1 ms. Se conservan y describen en analysis.json,
separados del grupo de cuatro shards solicitado por npm run bench. No se borran
controles negativos ni se seleccionan mediciones favorables.

La captura ordinaria declara tres warmups por fila/proceso, pero el arnés no guarda
sus duraciones crudas: no se reconstruyen. Los snapshots de proceso después del
cierre, un turno del event loop y GC no son memoria pico ni prueba general de
recolección de Window/Document. memory-endpoints.jsonl conserva todos los campos de
cada reporte de workload, incluidas observaciones adicionales de realm cuando existen.

El CI general terminó después con sus ocho jobs aprobados; su colección íntegra
está en reports/validation/general-ci/40191262985/. analysis.json conserva el estado
`in_progress` del snapshot de transporte original, sin reescribir ese dato histórico.
Estos benchmarks no aceptan ni reemplazan ownership-combined-process-means-v1:
performanceAccepted=null y gateReevaluated=false. Los rechazos históricos permanecen.

El lector actual solo usa datos y pins independientes en constants/ci-validation.json.
Autentica los 30 archivos físicos del transporte antes de crear la salida y copia
solo esos paths, sin seguir enlaces ni incluir archivos extra. La revisión inicial
detectó ese borde y la QA final conserva su corrección con casos reales de recursión
hacia el padre de la salida, archivos ajenos y corrupción de bytes.
No ejecuta scripts de ZIP, paquetes guardados ni DOM. Desde esta carpeta:

```sh
python analyze-current-ci-data.py --verify transport
python analyze-current-ci-data.py transport /destino-nuevo
```

Se probó con Python 3.12.10 en Windows y 3.10.12 en Linux: reproduce comparisons.csv,
timing-spans.csv, memory-endpoints.jsonl y analysis.json idénticos byte por byte,
rechaza un ZIP alterado y una salida existente y conserva
todos los inputs. Los enlaces de entrada se ejercieron con symlink en Linux y junction
en Windows. El alias de salida mediante symlink se ejerció en Linux; Windows no permitió
crear ese enlace simbólico sin privilegios y se conserva esa limitación. La QA está en la colección
de validación del CI. Usar las fuentes actuales del repo; los scripts dentro de los
archivos de QA son únicamente evidencia para auditoría.
