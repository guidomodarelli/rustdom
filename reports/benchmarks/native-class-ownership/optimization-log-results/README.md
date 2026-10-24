# Logs completos de optimización: lectura offline

Captura única del launcher publicado en `8d4dcf67`, terminal exit0. Cuatro
procesos jsdom27.4.0 completaron las ocho cargas cada uno con tres warmups
y nueve muestras por lote. No se modificó el sampler original f5526bc1.
Los 288 tiempos medidos se conservan como datos instrumentados; no se usan
para aceptar presupuestos ni compararlos con los estudios anteriores.

El lector autentica 423 archivos, seis fuentes del método y las 387 originales,
la preparación antes/después, los cuatro reportes públicos y sus owners. Siete
tests en Linux y Windows pasan; incluyen lectura real del archivo y CLI sin -B
que conserva inputs sin generar bytecode dentro de la captura. Los dos lectores
producen resumen y ledger byte-idénticos. No se ejecutaron nuevos workers.

## Encabezados registrados

Son registros del log, no compilaciones únicas ni unidades de CPU. Bailout-start
y bailout-end se separan; compile-complete y optimization-complete no se suman
como trabajo único. Las líneas de payload permanecen completas en los crudos.

| Node | Copia | Bailout-start | Invalida código | Expulsa código | Abortos compile/opt | Sin clasificar |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| v22.12.0 | J0 | 530 | 7262 | 334 | 21 | 0 |
| v22.12.0 | J1 | 513 | 7375 | 320 | 14 | 0 |
| v24.14.1 | J1 | 745 | 3827 | 0 | 3 | 0 |
| v24.14.1 | J0 | 792 | 3820 | 0 | 11 | 0 |

Se conservaron 138.028 encabezados, con función, URL, tier y razón cuando
el formato los incluye. Las razones desconocidas se mantienen como tales. Hay
invalidaciones para código llamado cloneRange por weak objects/embedded weak
objects cleared, y registros de compilación de generated/Range.js y Range-impl.js.
Las invalidaciones sin URL no permiten decidir por el nombre solo cuál de esas
funciones representan. Las direcciones pueden cambiar o reutilizarse y no son
IDs estables entre procesos. No se fabrican enlaces entre registros.

Los logs también incluyen parseo, setup, GC explícito y cleanup. No contienen
alineación verificable con cada cronómetro DOM; no se atribuyen los eventos
a intervalos medidos, warmups concretos o pausas. El tracing altera la ejecución.
No demuestra la causa del rechazo de Azure ni que más warmups lo resuelvan.

## Reproducción y límites

`read.py CAPTURE NEW_OUTPUT` autentica y lee archivos, sin ejecutar DOM. El
ledger completo headers.jsonl, las fuentes, comandos, stdout/stderr, reportes,
lecturas anteriores y validaciones están dentro de
`reports/validation/native-class-ownership/optimization-log-capture/capture-and-reading.tar.gz`.
`summary.json` conserva todas las categorías, razones y funciones; observations.json
conserva las 32 filas y sus 288 tiempos, con memoria post-cleanup.

Host WSL2 i7-1360P, CPU2 solo para el principal según el sampler original;
no es el Azure del ensayo de aceptación. Versiones, hardware y afinidades
están en el índice y los reportes conservados. No hay medidas de CPU exacta
o ausencia de fugas. Ownership sigue abierto y los rechazos no cambian.
El siguiente contraste debe corregir una hipótesis concreta del sampler,
conservar las ocho cargas y sus presupuestos y comprobar calibración completa.
