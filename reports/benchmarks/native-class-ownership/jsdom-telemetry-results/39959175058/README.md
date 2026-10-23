# Diagnóstico CPU/GC/JIT de jsdom: resultado íntegro

La única captura autorizada [39959175058](https://github.com/guidomodarelli/rustdom/actions/runs/39959175058)
terminó correctamente sobre `22aeb0ba709f9a2959f4fe482b043f43d59794ad`.
Los 64 procesos completaron las ocho cargas, ambas copias J0/J1, semillas
1/16 y Node 22.12.0/24.14.1. Se conservan 768 intervalos: 192 warmups y
576 medidos. El método se publicó, revisó y autenticó antes de capturar.
`accepted:null`, `gateReevaluated:false`: no es evidencia de aceptación.
El estudio original 39921160254 sigue rechazado por sus trece controles.

Referencia jsdom 27.4.0; runner GitHub ubuntu-22.04, Linux 6.8.0-1064-azure,
cuatro vCPU AMD EPYC 9V74 y 16765411328 bytes de RAM. La captura duró desde
13:12:22.354 hasta 13:17:22.233 UTC del 23 de octubre de 2026. El hilo principal
usó CPU 2 y se conservaron las afinidades de fondo originales. Los detalles
completos están en `capture/index.json` dentro del artefacto original.

## Qué se observa y qué queda pendiente

La instrumentación confirma actividad de V8 durante las operaciones medidas.
En Node 22 JIT, mutation-records-collect/100 tiene eventos posibles y contenidos
en el envelope observado en 8/9 operaciones en ambas semillas. Aparecen
registros `function,turbofan` de getters de MutationRecord y
`isHostInclusiveAncestor`. Son instantes de emisión del logger; no son CPU ni
pausas de compilación. No se atribuyen a los procesos separados de CPU.

La incertidumbre importa: para esa misma carga en Node 24 hay eventos JIT
posibles en 8/9 intervalos por semilla, pero solo 1/9 contiene algún evento
para todo el envelope observado. No convertir todos los posibles en seguros.
Los anchos de esos envelopes JIT son 314–396 us en Node 22 y 365–423 us en
Node 24; CPU tiene 22–33 us y 27–46 us respectivamente. Son rangos observados
de extremos, sin garantía universal sobre deriva entre ellos.

GC se observó durante las 18/144 operaciones medidas de cada combinación
Node/modo. En Node 22 corresponde a observer-delivery-records/1000; en
Node 24 a mutation-records-collect/1000. Las otras 126/144 no registran GC
que interseque el intervalo de operación, aunque el setup y el cleanup sí
registran GC. Esto no descarta efectos previos del allocator ni del runtime.

Las trayectorias tampoco se estabilizan de forma uniforme con el índice.
En Node 22 JIT, mutation-records-collect/100 pasa de una mediana de los tres
primeros/tres últimos intervalos de 2,619/2,187 ms con semilla 1 y
2,272/2,517 ms con semilla 16. Ambos procesos no registran GC dentro de esas
nueve operaciones. En Node 24 JIT son 1,435/1,108 ms y 1,441/1,094 ms.
Son descripciones instrumentadas de procesos individuales, sin contraste
A/B ni inferencia causal o estadística hacia las dieciséis semillas originales.
`trajectories.csv` y `summary.json` incluyen todas las 64 trayectorias y sus
768 intervalos; no se excluyeron filas, semillas ni valores desfavorables.

En las hojas del perfil CPU de mutation-records-collect/100 aparecen
`queueMutationRecord`, funciones de SymbolTree y operaciones de Node/CharacterData.
Los diez frames más frecuentes por proceso se conservan con URL y conteos.
Los conteos de ticks no equivalen a tiempo CPU ponderado y pueden no cubrir
operaciones cortas. Los 52 deltas negativos se conservan en su orden original;
no se recortan ni ordenan. process.cpuUsage incluye todos los threads y los
costos de sus lecturas fuera del timer original.

El diagnóstico respalda investigar el estado de calentamiento y tiering de
V8 por carga. No identifica la causa suficiente de los trece rechazos del
estudio anterior, ni justifica cambiar presupuestos, descartar muestras,
agregar un warmup arbitrario o repetirlo hasta conseguir aprobación.
El cierre de rendimiento del PR sigue pendiente; no hay tag ni merge.

## Integridad, lectura y recursos

El artifact oficial 12504756416 tiene 97613352 bytes, SHA256
`ef50c0b640187ce67739c27ce8f95d139a7e2ccab9266748f9f14bbede7c6cd8`.
Se guarda completo en cuatro partes ordenadas, sin recomprimir ni filtrar.
Concatenarlas reproduce el ZIP exacto; `transport.json` contiene tamaños y
hashes de partes y del conjunto. El tar interior tiene SHA256
`d1f320f6a847cec212e8ee18068e39dfe1f93ba59d527b2a55d05f7a14d39211`.
Se verificaron CRC, run/head/attempt, preparación, 434 fuentes del arnés,
derivaciones, Node/PID observados, flags, resultados públicos y cada archivo
de proceso. `raw-members.json.gz` registra los 9308 miembros, incluidos
8320 archivos regulares / 929153784 bytes. Conserva perfiles, logs V8,
GC, índices, preparación, fuentes, hardware y comandos originales.

Los lectores offline Node 22 y 24 verificaron los mismos 64 procesos y
produjeron filas idénticas; `replay.json` registra su hash canónico común.
Los dos replays completos están guardados comprimidos. No ejecutan DOM,
perfiles ni benchmarks. Los helpers usados se conservan en `tools/` como
provenance operativa; algunos contienen rutas de esta máquina. No volver a
ejecutar productores archivados para leer esta evidencia.

`tools/verify.cjs` es el verificador portable probado: recibe la carpeta
`jsdom-telemetry` extraída y un archivo JSON de salida que no exista. Usar
este checkout y Linux x64 con glibc 2.35 y los ejecutables oficiales fijados
Node 22.12.0 o 24.14.1. Autenticar primero el ZIP reconstruido con el SHA256
anterior y extraer su tar en una carpeta nueva. Desde la raíz del repositorio:

```sh
node reports/benchmarks/native-class-ownership/jsdom-telemetry-results/39959175058/tools/verify.cjs /ruta/jsdom-telemetry /ruta/replay-nuevo.json
```

Este comando lee los archivos existentes y comprueba integridad, resultados
públicos e identidad; no produce nuevas muestras. Los replays portables de
ambos Node coincidieron con los originales. Cuatro pruebas de error
comprobaron argumentos faltantes y preservación de un output existente;
ver `portable-validation.json`.

Se preservan 768 Window y 768 Document observados por separado, tres primeras
rondas no claras y 128 endpoints finales claros antes de salir. Las 32 sesiones
Inspector se detuvieron y desconectaron; los otros procesos usan JIT sin
Inspector. Ver `reports/memory/jsdom-telemetry-39959175058.*` para rangos
RSS/heap/external y límites. No se midió memoria pico ni se demuestra ausencia
universal de fugas; el diagnóstico solo ejecuta jsdom, sin el addon Rustdom.

Los seis casos de Python optimizado rechazaron `-O` y `PYTHONOPTIMIZE` antes
de autenticar o resumir datos. El método tiene doce contratos por Node, y la
revisión aislada del colector/lectores cerró los hallazgos de optimización y
codificación UTF-8. La revisión de esta interpretación se guarda por separado.
