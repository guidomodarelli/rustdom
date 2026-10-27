# Corrección del productor de evidencia actual

El CI de b9e7f9fb intentaba construir las fuentes actuales usando el productor
del estudio histórico C. Rechazaba `cb439f10…` porque ese estudio fija
`0d67e1d8…`. El rechazo sigue siendo correcto para reutilizar sus tiempos.
El productor v2 permite construir un candidato nuevo y conservar su identidad,
sin conceder aceptación de rendimiento. Los lectores v1/v2 rechazan cruzar sus
archivos y los presupuestos anteriores siguen intactos.

La calificación real local, raíz `/tmp/rustdom-current-preparation-t1h8oumd`,
terminó con exit0. Ejecutó instalación y build release de baseline y candidato,
workers públicos de cinco paquetes y contratos reales:

| Entorno | Contratos actuales | Contratos históricos | Casos del worker |
| --- | ---: | ---: | ---: |
| Node 22.12.0, WSL2 | 14/14 | 17/17 | 15/15 |
| Node 24.14.1, WSL2 | 14/14 | 17/17 | 15/15 |
| Node 24.14.1, Windows | 6/6 de inputs | No ejecutados aquí | No ejecutados aquí |

Los contratos ejercen archivos reales, fuentes opcionales `.npmrc`, cambios de
inputs, relocación del paquete, CLI, rechazo de flags heredados, identidad
obsoleta y un propietario falsamente declarado como liberado. El test de
relocación vuelve a ejecutar el worker real. No hay mocks de DOM ni medición
de tiempos DOM. Ambos lectores siguen aceptando su archivo original.

`qualification.tar.gz` conserva `prepared/` completo —fuentes, logs de build,
distribuciones, dependencias y symlinks relativos—, los comandos y sus salidas.
`archive.json` registra cada archivo/enlace y la lectura completa del tar
verificada contra sus bytes originales. El archivo v1 se autentica usando el
ZIP y recibo ya versionados en `../hosted-build-ci/39720077911/`.

`sources.json` identifica los once archivos del productor al calificar y al
publicar. Después de los tests solo cambian la agrupación equivalente de las
escrituras GITHUB_ENV y el estado documental del protocolo. El código ejecutado
y los tests conservan sus bytes calificados. Los logs del fallo original de CI
y el pase de actionlint se conservan por separado; el pase usa shellcheck.
Git normaliza los archivos de texto a LF. También exporté los once blobs
exactos del índice y repetí los 14 contratos actuales y 17 históricos en ambos
Node: todos pasan. `index-byte-validation.json` y `index-*.log` conservan esos
comandos y resultados. El tar mantiene los bytes originales de la calificación.

Cada worker observa 15 Window y 15 Document por separado. Los cinco endpoints
alcanzan cero supervivientes y regresan al baseline nativo. Los contratos de
relocación repiten la liberación. Esto prueba esos escenarios finitos; no
certifica ausencia absoluta de fugas ni memoria pico. Herramientas, hardware,
huellas, trazas de recursos y límites están en `summary.json` y los crudos.

Esta calificación local no prueba todavía el workflow de GitHub sobre el SHA
publicado. No cambia algoritmos DOM ni cuenta como migración adicional a Rust.
`measurementExecuted=false`, `performanceAccepted=null`; no autoriza merge o
tag del hito de ownership mientras el gate de rendimiento permanezca rechazado.
