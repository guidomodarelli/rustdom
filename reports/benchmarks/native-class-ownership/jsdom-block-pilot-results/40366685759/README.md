# Fallo técnico preservado del piloto v1

Run [40366685759](https://github.com/guidomodarelli/rustdom/actions/runs/40366685759),
intento 1, fuente `1078e4fd190276a116e6dc5e64c9fe32eca3e7e9`.
El preflight aprobó y los 32 criterios fallaron durante la preparación.

`source.snapshot()` copió el paquete a `inputs/packages.tar.xz`; el coordinador
intentó crear `inputs/` nuevamente y lanzó `EEXIST`. Los 32 archivos muestran
el mismo fallo antes del índice, marcador de inicio y bucle de workers.
No se lanzaron workers de benchmark: hay cero duraciones medidas, warmup y
observaciones de Window/Document. Tampoco existen snapshots de memoria del padre.
No son resultados estadísticos ni evidencia de aceptación de rendimiento.

Se conservan íntegros los 33 ZIP originales (408 198 146 bytes), 32 tar,
metadata API, 33 logs de job, inventarios y parciales. `evidence/audit/`
contiene las 32 verificaciones de los 850 miembros del snapshot y 64 replays
parciales con Node 22.12.0/24.14.1. Sus resultados siguen siendo
`complete=false`, `reason=no-index`, `analysis=null`,
`sourceBindingChecked=false`; el enlace al snapshot se verificó aparte.
Los scripts en `reader-source/` documentan el transporte y la auditoría usados;
no ejecutar código archivado para reproducir el estudio.

`preservation.json` registra hashes y tamaños de todos los archivos conservados,
incluida la calificación final del SHA 1078. Puede verificarse con el lector
actual `reports/validation/jsdom-block-pilot-v2/verify-preservation.py`.

La revisión aislada confirmó la causa y el alcance. La secuencia v1 quedó
consumida: no se relanza, no se reaplica su etiqueta y no se completan muestras.
El sucesor v2 corrige el orden y hace que ambos modos usen el mismo setup;
se prepara deshabilitado y debe calificarse antes de una ejecución propia.
`performanceAccepted=null`, `gateReevaluated=false`. Los rechazos históricos
de ownership y el runtime híbrido siguen vigentes.
