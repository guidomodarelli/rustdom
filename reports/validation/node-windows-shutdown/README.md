# Aborto de Node 24.14.1 al cerrar procesos Windows

El run 40263224047, intento1, commit e6c4e6a9, terminó con cinco jobs aprobados
y un fallo Windows/Node 24.14.1 del candidato combinado anterior. La calificación
falló en WPT, sin timeout, al ejecutar FileAPI/file/File-constructor-endings.html:
exit3221226505 y `UV_HANDLE_CLOSING` en libuv Windows async.c:76.
El ZIP original artifact 12625996310, metadata, logs, manifiesto completo y
reporte adverso están en `20261026/failed-ci/`. Su tamaño es4449480 bytes y SHA
`d5de84d4e8163f5de63d1d2364522f037692d1a6c2d9fc8b85fdc5663b8571a4`.

## Diagnóstico funcional independiente

Antes de cambiar CI se fijó una secuencia local Windows de 48 procesos: por SDK,
ocho procesos Node puro y cuatro de la fixture por engine jsdom/rustdom. No es
un estudio de rendimiento, no completa muestras anteriores ni acepta un gate.
Todos los resultados, incluidos los abortos, están en `20261026/diagnosis/`.

| SDK Windows | Node puro, ocho procesos | Fixture jsdom, cuatro | Fixture rustdom, cuatro |
|---|---|---|---|
| 22.12.0 | 8 salidas normales | 4 aprobadas | 4 aprobadas |
| 24.14.1 | 8 abortos UV_HANDLE_CLOSING | 4 aprobadas | 4 aprobadas |
| 24.20.0 | 8 salidas normales | 4 aprobadas | 4 aprobadas |

El repro Node puro utiliza un servidor HTTP loopback real con redirects y
salida inmediata tras la excepción de fetch, sin cargar `.node` ni rustdom.
Las ocho salidas antiguas imprimieron el mismo aborto que CI. Reproduce la
clase de fallo de la plataforma sin necesitar un addon; no se obtuvo un stack
nativo del proceso remoto que demuestre que cada frame del aborto remoto sea
idéntico. La fixture aislada no reprodujo localmente el aborto intermitente:
sus24 procesos pasaron 45 aserciones cada uno. El DLL local se identifica en
sdk-verification.json y **no se presenta como el candidato combinado hosted**.

El [fix oficial nodejs/node#61999](https://github.com/nodejs/node/pull/61999/files)
impide publicar tareas retrasadas después del cierre de su scheduler. La
[versión24.20.0](https://nodejs.org/en/blog/release/v24.20.0) incluye ese cambio.
Su Node Windows instalado se autenticó contra SHASUMS256 oficial:
`5c976096e04e5c2c1f091938926234cc9fbebfe9787ddd149351b3b0ecc707b5`.

## Corrección de CI y regresión

Las tres matrices funcionales activas de candidatos usan Node 24.20.0 en su
fila Windows/24; conservan Node 22.12.0 Windows y ambos SDK antiguos Linux/macOS.
Los nombres de job y los recibos registran el SDK real. Se admite esa versión
en las configuraciones de calificación y se actualiza el pin transitivo del
helper compartido de owners. No cambian Rust, bindings, corpus, aserciones,
presupuestos, estimadores, capturas ni los SDK fijados de estudios históricos.

El CI general ya usa Node 24 LTS actualizado y no necesitó cambiarse. Los
workflows históricos condicionados a etiquetas no se activan ni modifican.
No se ocultan crashes, no se ignoran exit codes y no se reintentan fixtures.
Solo las tres matrices funcionales cancelan automáticamente un run anterior
del mismo workflow/PR cuando llega un head nuevo. Los workflows científicos
conservan su propia política y no se cancelan por este cambio.

El nuevo contrato `.github/scripts/windows-node-exit.spec.cjs` ejecuta dos
procesos HTTP reales, comprueba redirects, ausencia de addons y terminación
observable. Pasó Windows/Node 22.12.0/24.20.0 y Linux22.12.0/24.14.1. Falló de la
forma esperada con Windows/Node 24.14.1; el log negativo se conserva. Nueve contratos
reales de Git/preparación y actionlint también pasaron.

Con el SDK Windows/Node 24.20.0 pasaron además los comandos originales `test:jest`,
`test:vitest` y `test:vm`: 22, 33 y 34 tests. Se ejecutaron sobre una copia de 897
archivos de runtime/configuración/tests, con hashes preservados y el DLL local
identificado; no se compiló ni calificó el candidato combinado hospedado en esa
copia. Las dependencias Windows se reinstalaron desde el lockfile porque las
anteriores carecían de shims/dependencias de plataforma. Jest no descubría tests
bajo el prefijo oculto del worktree y además veía fixtures temporales duplicadas;
la copia en una ruta sin ese prefijo usa los mismos tests y configuraciones.
Se conservan los intentos de setup fallidos, incluida la invocación prematura
antes de terminar la copia. El caso de descubrimiento solo conserva un extracto
transcrito del output de herramienta, identificado como tal, no un log íntegro.

La nueva matriz hosted completa todavía debe comprobar la selección de SDK
y las suites de los candidatos. Esta corrección de una dependencia no acepta
rendimiento ni resuelve el rechazo ownership. No hubo tag ni merge. Los scripts
diagnósticos `.txt` se guardan como evidencia; no ejecutarlos desde el archivo.
