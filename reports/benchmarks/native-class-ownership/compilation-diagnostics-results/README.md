# Captura nativa parcial de compilación

Fuente publicada antes de ejecutar: `4e1e66c1e30e54b6e29ce275d8890a9add3b2df8`.
Se invocó una vez el orquestador publicado, con Node 22.12.0 y 24.14.1,
preparación oficial fijada y las 390 partes derivadas autenticadas. No hubo
reintentos. El método mantiene ocho cargas, tres warmups y nueve muestras;
añade tracing V8 y no modifica el arnés ni los presupuestos de aceptación.

Los cinco procesos de Node 22 y cuatro de Node 24 terminaron con exit 0. El
último, J0/jsdom de Node 24, terminó por SIGSEGV. El recorder terminó con exit 2.
`partial-4e1e66c1/analysis.json` conserva los diez estados de proceso y cada
intervalo persistido, incluidos los que no tienen eventos disponibles.

| Cobertura | Cantidad |
| --- | ---: |
| Intervalos planificados | 960 |
| Timings persistidos | 876 |
| Intervalos con trace nativo disponible | 864 |
| Timings con eventos desconocidos | 12 |
| Intervalos planificados sin registro | 84 |
| Eventos nativos observados | 1.028.405 |
| Eventos completos X de categoría de compilación | 1.008.081 |

El proceso fallido conserva un lote completo y otro iniciado sin spans
persistidos. No tiene `trace.json`; su telemetry solo contiene el header inicial.
Los datos ausentes no representan ceros ni prueban que no se ejecutaran operaciones.

Entre los 648 intervalos medidos con trace disponible, 405 intersectan eventos
`V8.OptimizeCode` del hilo principal para cada offset dentro del envelope
observado en los extremos. Se conserva el desglose de las ocho cargas en
`summary.json`. Los eventos no equivalen a compilaciones únicas ni a funciones,
y sus duraciones no se suman como tiempo de CPU o pausas. Esta observación
después de tres warmups no demuestra que la compilación explique los deltas de
Azure ni que aumentar los warmups resuelva esos deltas.

## Lectura y reproducción

`analyze.py` tiene siete casos numéricos de intersección. Trata las ventanas
como intervalos semiabiertos y los eventos de duración cero como puntos. Lee
todos los eventos; asigna a spans los eventos X de compilación y conserva las
demás categorías/fases en los grupos y en los crudos. Comprueba los hashes de
los nueve traces completos y los PID. El envelope usa los dos anclajes
hrtime/performance: no garantiza un límite global del reloj entre extremos.

El lector ya se ejecutó sobre este artefacto parcial. Para reproducir solo la
lectura, extraer el tar de validación en un directorio nuevo y ejecutar:

```sh
python3 -B analyze.py EXTRACTED/native-compilation-partial/capture NEW_ANALYSIS.json
```

El lector está acotado a los reportes presentes en este artefacto; no es un
recuperador genérico de archivos corruptos o ausentes. `reader-source.json`
identifica sus bytes. No ejecutar otra vez el CLI de captura ni sus workers.

Los crudos completos, fuentes, comandos, preparación, logs y fallo están en
`reports/validation/native-class-ownership/compilation-diagnostics-partial/`.
El host es WSL local, i7-1360P con 16 CPU visibles; no es el host Azure del
experimento de aceptación. No se acepta rendimiento ni se reevalúa su gate.
El resultado negativo `39735778846` permanece intacto. Ownership continúa
abierto y esta publicación no es un checkpoint funcional.
