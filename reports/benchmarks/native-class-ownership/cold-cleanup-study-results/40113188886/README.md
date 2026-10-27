# Estudio de limpieza fría: resultado completo rechazado

El run [40113188886](https://github.com/guidomodarelli/rustdom/actions/runs/40113188886),
job120928996128, intento1, ejecutó una sola secuencia del método
ownership-cold-cleanup-v1 en b63cf834de153c3b033d88ad961afb6329c19f5a.
La captura terminó completa con exit1 por la decisión de rendimiento rechazada;
stderr está vacío. No fue un timeout ni una captura parcial: el step duró
2h17m06s, dentro de175min; el job finalizó a las19:08:52UTC del24/10.
La reproducción estricta pasó en Node22.12.0 y24.14.1 con resultado idéntico,
verified=true y accepted=false. Integridad no equivale a aceptación de rendimiento.

Se conservaron los2048procesos,18432duraciones medidas,6144warmup,
24576Window y24576Document observados por separado,6144rondas de limpieza,
4096estados finales claros y3snapshots del padre. No se agregaron muestras,
se repitió la secuencia ni se cambiaron estimador o presupuestos.

## Decisión y resultados desfavorables

Ocho controles de jsdom exceden±2%: tres en AA y cinco en AB. Una fila Rust
excede+5%: range-control-1000/250, Node24, AB, +6.5743%; su control jsdom
también falla con+3.5261%. Este resultado no permite atribuir causalmente
esa diferencia al candidato. Las dos versiones rechazan la decisión íntegra.
Se mantienen los rechazos históricos y no se reevalúa su gate.
Las32filas, favorables y desfavorables, se muestran abajo y se conservan
sin redondear en comparisons.csv, analysis.json y los replays completos.
AA contrasta A0/A1; AB contrasta el baseline A0 o A1, según reverseAssignment,
con B. Los porcentajes son diferencias
entre paquetes Rust o controles jsdom correspondientes, no Rust frente a jsdom.

| Node | Fase | Fila | Rust % | Control jsdom % | Calibrado | Dentro del presupuesto |
| --- | --- | --- | ---: | ---: | --- | --- |
| v22.12.0 | AA | mutation-records-collect/100 | +0.1392 | +1.3261 | sí | sí |
| v22.12.0 | AA | mutation-records-collect/1000 | -0.2580 | +0.1153 | sí | sí |
| v22.12.0 | AA | observer-delivery-records/100 | -0.3643 | +0.3628 | sí | sí |
| v22.12.0 | AA | observer-delivery-records/1000 | -0.0678 | +0.2076 | sí | sí |
| v22.12.0 | AA | range-control-1000/1000 | -1.3626 | +0.1739 | sí | sí |
| v22.12.0 | AA | range-control-1000/250 | -1.3398 | +5.1139 | no | no |
| v22.12.0 | AA | range-state-lifecycle-1000/1000 | +0.3225 | -0.2198 | sí | sí |
| v22.12.0 | AA | range-state-lifecycle-1000/250 | +0.0186 | -1.7097 | sí | sí |
| v22.12.0 | AB | mutation-records-collect/100 | -0.6232 | +1.3602 | sí | sí |
| v22.12.0 | AB | mutation-records-collect/1000 | -0.6936 | -0.5814 | sí | sí |
| v22.12.0 | AB | observer-delivery-records/100 | -0.5106 | -0.3005 | sí | sí |
| v22.12.0 | AB | observer-delivery-records/1000 | +0.0441 | +3.3077 | no | no |
| v22.12.0 | AB | range-control-1000/1000 | +0.0830 | +8.1578 | no | no |
| v22.12.0 | AB | range-control-1000/250 | -2.7593 | -4.5490 | no | no |
| v22.12.0 | AB | range-state-lifecycle-1000/1000 | -1.0794 | +1.6060 | sí | sí |
| v22.12.0 | AB | range-state-lifecycle-1000/250 | -0.6152 | -2.7921 | no | no |
| v24.14.1 | AA | mutation-records-collect/100 | +0.5924 | +0.2531 | sí | sí |
| v24.14.1 | AA | mutation-records-collect/1000 | +0.4526 | +1.8060 | sí | sí |
| v24.14.1 | AA | observer-delivery-records/100 | -0.4039 | +0.3381 | sí | sí |
| v24.14.1 | AA | observer-delivery-records/1000 | +0.0167 | +0.3397 | sí | sí |
| v24.14.1 | AA | range-control-1000/1000 | +0.1469 | -0.6162 | sí | sí |
| v24.14.1 | AA | range-control-1000/250 | -1.8604 | +6.3766 | no | no |
| v24.14.1 | AA | range-state-lifecycle-1000/1000 | -1.2526 | +3.3313 | no | no |
| v24.14.1 | AA | range-state-lifecycle-1000/250 | -0.2814 | -0.6186 | sí | sí |
| v24.14.1 | AB | mutation-records-collect/100 | -1.1061 | -0.4789 | sí | sí |
| v24.14.1 | AB | mutation-records-collect/1000 | -1.5349 | -0.4459 | sí | sí |
| v24.14.1 | AB | observer-delivery-records/100 | +0.3524 | +0.2454 | sí | sí |
| v24.14.1 | AB | observer-delivery-records/1000 | -1.0326 | -0.3397 | sí | sí |
| v24.14.1 | AB | range-control-1000/1000 | -0.9940 | +1.7266 | sí | sí |
| v24.14.1 | AB | range-control-1000/250 | +6.5743 | +3.5261 | no | no |
| v24.14.1 | AB | range-state-lifecycle-1000/1000 | +2.1926 | -0.9573 | sí | sí |
| v24.14.1 | AB | range-state-lifecycle-1000/250 | -2.9144 | +0.5869 | sí | sí |

## Archivo e identidad

Artifact12572122750, nombre
ownership-cold-cleanup-b63cf834de153c3b033d88ad961afb6329c19f5a-attempt1.
ZIP10997300bytes, SHA256
b82e1d3d9af43d7c0d2f39924cdfa9a6fd277bbe74ffcc9ab5d7150df2499eaf.
Tar11054240bytes, SHA256
563db7ddba39c7c05153444de6c97181a41e502a2c810b7784c82942423bd7a5.
Se autenticaron ID, run, SHA, intento, nombre, tamaño, digest de API y CRC.
El tar conserva íntegros19214miembros,16209archivos regulares,
1401764670bytes regulares y6enlaces. raw-members.json.gz enumera todos los
miembros con sus hashes/tipos/destinos; ZIP, tar, metadataAPI, logs, stdout,
stderr y exit-code originales permanecen en este paquete.

El candidato B es el ELF0a949fb3441baca338c7ba2b383011bdc516ba63f164bc2e4e1152f124155776
del artifact de preparación12549521134. No es el9bablocal. Se verificaron
los511pins del método y el grafo congelado de434fuentes. No hubo rebuild.
La máquina y los hashes/versiones de runtimes están en analysis.json/replay.json.

## Lectura offline y QA

Usar un checkout Git Linux real, limpio, del SHA b63cf834. No usar un gitfile
Windows desde GitWSL ni normalizar sourceCommit/sourceChanges/sourceGitErrors.
Los Node fijados son22.12.0 y24.14.1; sus hashes están en replay.json.
Definir REPO como ese checkout, PACKET como este directorio versionado,
DEST como un directorio nuevo fuera de los inputs y NODE como cada Node fijado:

```sh
python3 "$PACKET/tools/extract.py" "$REPO" "$PACKET" "$DEST"
"$NODE" "$REPO/reports/benchmarks/native-class-ownership/cold-cleanup-study/study.cjs" --verify "$DEST/cold-study/capture"
"$NODE" "$PACKET/tools/analyze.cjs" "$REPO" "$DEST/cold-study/capture" "$OUTPUT"
python3 -B "$PACKET/tools/transport.spec.py" "$REPO" "$PACKET"
```

OUTPUT debe ser otro directorio nuevo fuera de capture. No ejecutar ningún
script del tar. collect.py solo consulta/transporta el run consumido y no
activa workflows. extract.py usa el extractor seguro actual por hash.
Los18contratos de transporte pasan sobre el ZIP real en Linux y Windows;
los5contratos del artifact cotejan todas las muestras exportadas, recursos,
comparaciones y rechazos con los workers originales. Los10contratos del
lector de recursos pasan en ambos Node sobre datos históricos genuinos sin
reclasificarlos; se conservan todas las QA previas y sus limitaciones temporales.
El replay completo y los cuatro exports nuevos son idénticos entre ambos Node.

## Recursos y alcance

264primeras rondas no están claras y se conservan; las dos rondas finales
de cada proceso sí están claras. Los baselines nativos y Window/Document
son independientes. memory.json y reports/memory/cold-cleanup-study-40113188886.*
conservan rangos y los tres snapshots del padre. Son observaciones finitas
tras GC de workers y snapshots del padre sin GC forzado: no prueban memoria
pico ni ausencia universal de fugas ni causalidad de diferencias entre grupos.

No se integra este candidato, no hay tag ni merge de ownership. El runtime
sigue híbrido y el objetivo de migración completo sigue pendiente. La
autorización permanente permite investigar el siguiente cambio justificado
sin repetir esta secuencia ni pedir otro permiso operativo.
