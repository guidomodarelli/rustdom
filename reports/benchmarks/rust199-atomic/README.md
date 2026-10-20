# AbortSignal: reemplazo del atomic deprecado en Rust 1.99

Mediciones del 20/10/2026 en Linux x64/WSL2. Se compara el paquete de
`016ae91` reconstruido con Rust 1.99.1 contra el bucle CAS final, también
construido con Rust 1.99.1. El jsdom independiente es la referencia 27.4.0.

Máquina: 13th Gen Intel(R) Core(TM) i7-1360P; 16 CPUs lógicas;
6.6.87.2-microsoft-standard-WSL2. La configuración y las versiones completas están
en cada JSON crudo. La corrección de CI no es una optimización anunciada.

## Metodología

- Ocho reportes completos, 32 procesos aislados en total, Node 22.12.0 y 24.14.1.
- Dos repeticiones: baseline → candidato y candidato → baseline. Cada reporte
  invierte además el orden jsdom/rustdom entre sus dos pares de procesos.
- Cada fila agrupa 36 muestras por motor y etapa: cuatro procesos, tres warmups
  y nueve muestras por proceso. No se eliminan outliers. Los p95, mínimos y
  máximos están en `comparison.json`; cada observación se conserva en los JSON.
- Entradas de 100/1.000 señales. Se mide la operación pública, con puente y
  WebIDL. Preparación, verificación, cierre y GC quedan fuera del tiempo.
- Lifecycle incluye construcción/abort/lecturas; any incluye composiciones;
  propagation prepara dependientes y mide aborto con entrega real de callbacks.
  Esta última excluye la reserva inicial de IDs y ayuda a observar ruido ajeno
  a la línea cambiada. Se comprueban razones, estados, orden, deduplicación y hashes.
- El harness emplea HTML sin scripts para su contexto auxiliar. Las operaciones
  de señal usan estado/grafo Rust en rustdom; factories, eventos y callbacks
  aún conservan parte del host JavaScript.
- La memoria del JSON es posterior a cierre/GC; no mide memoria pico.

## Resultados agrupados

| Node | Operación | Señales | Antes (ms) | Después (ms) | Variación | jsdom/rustdom final |
|---|---|---:|---:|---:|---:|---:|
| v24.14.1 | abort-lifecycle | 100 | 2.002 | 2.050 | +2.38% | 0.42× |
| v24.14.1 | abort-any | 100 | 0.706 | 0.750 | +6.20% | 0.44× |
| v24.14.1 | abort-propagation | 100 | 1.740 | 1.721 | -1.09% | 0.32× |
| v24.14.1 | abort-lifecycle | 1000 | 17.514 | 17.367 | -0.84% | 0.34× |
| v24.14.1 | abort-any | 1000 | 4.983 | 4.976 | -0.13% | 0.45× |
| v24.14.1 | abort-propagation | 1000 | 15.566 | 14.659 | -5.82% | 0.24× |
| v22.12.0 | abort-lifecycle | 100 | 2.297 | 2.308 | +0.45% | 0.43× |
| v22.12.0 | abort-any | 100 | 0.765 | 0.861 | +12.61% | 0.47× |
| v22.12.0 | abort-propagation | 100 | 2.054 | 2.255 | +9.81% | 0.32× |
| v22.12.0 | abort-lifecycle | 1000 | 18.397 | 17.886 | -2.77% | 0.39× |
| v22.12.0 | abort-any | 1000 | 5.572 | 5.612 | +0.71% | 0.48× |
| v22.12.0 | abort-propagation | 1000 | 17.115 | 17.789 | +3.93% | 0.22× |

Las medianas varían entre -5.82% y +12.61%.
El control jsdom varía entre -11.34% y +4.13%.
Las dos repeticiones y los resultados adversos están en la comparación; no se
atribuye causalidad a una sola corrida ni se afirma una mejora general.
El ratio final de 0.22–0.48× muestra costos
reales todavía pendientes frente a jsdom. La inversión de orden reduce un sesgo,
pero no elimina el ruido de CPU/GC ni convierte este ensayo en una prueba
estadística de equivalencia o de ausencia de regresiones.

## Evidencia

- [Comparación, distribuciones y órdenes](comparison.json).
- [Validación, identidades y memoria](../../validation/rust199-atomic.md).
- [Inventario y checksums](../../validation/rust199-atomic/evidence.json).
- v24.14.1, baseline: [JSON crudo](./2026-10-20T17-28-15.845Z-linux-x64.json.gz).
- v24.14.1, candidate: [JSON crudo](./2026-10-20T17-28-47.407Z-linux-x64.json.gz).
- v22.12.0, baseline: [JSON crudo](./2026-10-20T17-29-24.890Z-linux-x64.json.gz).
- v22.12.0, candidate: [JSON crudo](./2026-10-20T17-30-02.558Z-linux-x64.json.gz).
- v24.14.1, candidate: [JSON crudo](./2026-10-20T17-31-37.241Z-linux-x64.json.gz).
- v24.14.1, baseline: [JSON crudo](./2026-10-20T17-32-08.316Z-linux-x64.json.gz).
- v22.12.0, candidate: [JSON crudo](./2026-10-20T17-32-44.743Z-linux-x64.json.gz).
- v22.12.0, baseline: [JSON crudo](./2026-10-20T17-33-20.994Z-linux-x64.json.gz).

Los JSON grandes están comprimidos con gzip sin pérdida. `sourceHash` de cada
reporte identifica el harness y el árbol medido; `runtimeSource` y el SHA del
binario identifican el motor realmente cargado. El inventario conserva por
separado el digest de las fuentes publicadas del baseline y del candidato.
