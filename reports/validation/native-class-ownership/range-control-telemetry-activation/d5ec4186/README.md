# Activación única del diagnóstico AA de Range

Fuente inmutable `d5ec4186d2033709e532bc93d6f47d930afe525f`.
Run [40154725015](https://github.com/guidomodarelli/rustdom/actions/runs/40154725015),
job `121053535757`, intento 1. La etiqueta
`ownership-range-control-aa-telemetry-v1` se aplicó una sola vez: evento
`34161128543`, 2026-10-25 02:30:44 UTC. Nunca volver a ejecutar el activador,
reaplicar la etiqueta, relanzar el workflow o completar muestras faltantes.
La autorización permanente cubre el seguimiento, colección y análisis.

Antes del POST aprobaron los seis checks del SHA exacto. El CI general
`40152264918` terminó con ocho jobs aprobados, incluido Valgrind en Linux;
el método `40152264828` aprobó ambos Node 22.12.0/24.14.1. Sus artifacts
autenticados conservan Git limpio y el grafo revisado de 599 archivos. El
muestreador y las 563 fuentes históricas permanecen intactos. Los doce workflows
históricos disparados por el evento quedaron omitidos, sin otra captura.

La ejecución conserva 256 procesos planificados, 55 minutos de captura,
65 de step, 90 de job, 15 de archivo y 10 de subida. Se esperan 2304 medidas,
768 warmup, 3072 Window y 3072 Document por separado, 128 perfiles CPU y
128 logs JIT, tres rondas y dos estados finales claros por proceso. Esas
cantidades todavía no son resultados observados. La última observación guardada
muestra el step de captura activo. No existe un artifact final calificado ni
un replay nuevo completo en este registro.

`performanceAccepted=null` y `gateReevaluated=false` son invariantes del
diagnóstico. No acepta rendimiento ni reemplaza los rechazos históricos de
ownership. El runtime sigue híbrido; no añade APIs Rust completas ni habilita
tag o merge del PR80.

## Evidencia y correcciones operativas

evidence.zip conserva el POST, contexto, páginas API, timeline, CI, ZIPs,
logs, observaciones, fuente del helper y pruebas. members.json enumera todos
sus bytes con SHA256. Los scripts dentro del ZIP son solo evidencia: no
ejecutarlos. Los readers actuales fuera del ZIP son los entrypoints.

La primera invocación administrativa falló al convertir una ruta Windows a
WSL, antes de definir/aplicar la etiqueta y antes de cualquier POST. Se conservan
esa observación y su fuente. `as_posix()`/`wsl --exec` corrigieron el transporte;
un modo de solo lectura verificó la fuente, revisión y seis checks reales antes
de permitir el primer POST. La guarda contra Python optimizado también se probó
con `-O` y `PYTHONOPTIMIZE=1`. Ambas revisiones locales cerraron sin hallazgos.
No hubo una captura fallida ni repetida por ese error local.

El lector Windows pasó siete contratos y omitió uno por privilegios de symlink;
Linux pasó los ocho. La prueba Linux invocó el `gh.exe` real ya instalado mediante
un shim local de interoperabilidad, con PATH limitado al hijo. No se mockearon
GitHub ni SDKs. El fallo inicial por ausencia de `gh` en PATH y su snapshot
parcial se conservan. Las pruebas aceptan snapshots parciales explícitos sin
inventar un run.json ausente. La observación de PR head mutable solo es una
fixture de metadata; nunca modifica la identidad de las mediciones.

La CLI general negó logs de un job terminado mientras su run seguía activo.
Se preservó el ZIP parcial y se continuó por la API de logs de job. Los cinco
logs y artifacts de los cuatro shards/macOS quedaron autenticados; los reportes
finales de Linux/Windows y sus logs también están preservados. El CI general
puede usar el merge de integración: sus metadatos originales no se normalizan
ni se presentan como los paquetes congelados del muestreador.

## Continuar sin ejecutar DOM

Los lectores actuales solo consultan este run/job o transportan sus bytes:

```sh
python3 -B <packet>/tools/collect.py <repo> <coleccion-propia> --collect
```

Mientras el run siga vivo, devuelve observaciones; no descarga ni inicia DOM.
Al terminar, conserva log, metadata, ZIP y tar incluso si el resultado es parcial.
Antes de extraer hay que vincular el ID y hashes del artifact real autenticado
en tools/constants/transport.json; actualmente son null. No inventar esos pins.
extract.py falla antes de leer o escribir datos si aún no existen.

Para el replay usar fuentes revisadas del SHA d5ec4186 en un checkout Git Linux
real y limpio, no un gitfile Windows leído por Git WSL. El checkout local preparado
se llama range-aa-telemetry-source-d5ec4186. Usar ambos ejecutables fijados y
autenticados por hash. Nunca normalizar sourceCommit/sourceChanges/sourceGitErrors
ni ejecutar scripts del archivo recibido. Preservar controles, regresiones,
clocks inciertos, deltas negativos y parciales. Las métricas específicas de
Range se analizarán con sus nativeTree completos cuando exista el resultado.

No confundir este commit de documentación con la fuente de medición d5ec4186.
No volver a pedir autorización. No crear otra automatización ni estudio.
