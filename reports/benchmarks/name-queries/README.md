# Document.getElementsByName: mediciones antes y después

Baseline: checkpoint-061-element-relatives, main `55e2cb8`, árbol idéntico al
head revisado `0921ab0`. Se reutiliza su dist validado y addon `f5ae22cf…`.
Ambos motores Rust usan Rust 1.99.1 release con thin LTO. En el baseline el
recorrido y filtro de nombres todavía ejecutan JavaScript y lecturas N-API
por elemento; el candidato compara los atributos canónicos prestados en Rust.
Referencia independiente: jsdom 27.4.0. WebIDL, NodeList y su invalidación
conservan el host actual; el runtime continúa siendo híbrido.

Máquina: 13th Gen Intel(R) Core(TM) i7-1360P; 16 CPUs lógicas; 6.6.87.2-microsoft-standard-WSL2.

Cada muestra consume cien operaciones públicas. Los cuatro workloads de nombre
preparan 100/1.000 Element HTML y de namespace extranjero, con la mitad de los
name sin namespace seleccionados. Un atributo p:name con el valor de búsqueda
ausente debe ignorarse. create/miss incluyen una NodeList nueva por llamada;
live invalida un atributo antes de leer la lista retenida; cached no invalida.
El documento inicial está vacío: inputBytes registra sus 21 bytes de HTML,
no los bytes del DOM preparado. El tamaño de fila cuenta los Element añadidos.

Los tres controles —clases live/cached y refresco de children— conservan sus
fixtures previas y comprueban los helpers compartidos de atributos/proyección.
Se verifican contadores nativos antes de las lecturas auxiliares, identidades,
todos los atributos/resultados y el hash completo fuera del temporizador.
Preparación, importación, validación, cierre y GC quedan fuera del tiempo medido.

Ocho reportes, 32 workers y 36 muestras por fila/motor/etapa/runtime. Cada
proceso hace tres warmups y nueve muestras medidas. Se alternan etapas y motores.
Se conservan todas las filas, outliers, percentiles y muestras posteriores al GC.
Los smoke tests anteriores validaron el CLI bajo otros gates en ejecución;
sus tiempos están archivados como diagnóstico y excluidos de esta comparación.

| Node | Operación | Tamaño | Antes ms | Después ms | Variación | jsdom/rustdom final |
|---|---|---:|---:|---:|---:|---:|
| v24.14.1 | collection-class-live | 100 | 3.153 | 3.407 | +8.05% | 1.02× |
| v24.14.1 | collection-class-cached | 100 | 0.648 | 0.678 | +4.61% | 1.77× |
| v24.14.1 | collection-class-live | 1000 | 24.625 | 26.223 | +6.49% | 0.62× |
| v24.14.1 | collection-class-cached | 1000 | 3.874 | 4.024 | +3.88% | 0.97× |
| v24.14.1 | element-children-refresh | 100 | 2.342 | 2.408 | +2.82% | 0.96× |
| v24.14.1 | element-children-refresh | 1000 | 12.814 | 13.648 | +6.51% | 0.54× |
| v24.14.1 | document-name-create | 100 | 11.969 | 1.393 | -88.37% | 1.86× |
| v24.14.1 | document-name-live | 100 | 13.107 | 2.441 | -81.38% | 1.10× |
| v24.14.1 | document-name-cached | 100 | 0.185 | 0.190 | +2.52% | 1.00× |
| v24.14.1 | document-name-miss | 100 | 12.125 | 0.865 | -92.87% | 2.56× |
| v24.14.1 | document-name-create | 1000 | 109.006 | 13.797 | -87.34% | 1.05× |
| v24.14.1 | document-name-live | 1000 | 111.869 | 15.045 | -86.55% | 0.94× |
| v24.14.1 | document-name-cached | 1000 | 0.157 | 0.160 | +1.46% | 1.05× |
| v24.14.1 | document-name-miss | 1000 | 108.474 | 7.478 | -93.11% | 1.76× |
| v22.12.0 | collection-class-live | 100 | 3.688 | 3.797 | +2.94% | 1.18× |
| v22.12.0 | collection-class-cached | 100 | 0.717 | 0.757 | +5.59% | 1.26× |
| v22.12.0 | collection-class-live | 1000 | 25.044 | 26.516 | +5.88% | 0.66× |
| v22.12.0 | collection-class-cached | 1000 | 4.386 | 4.460 | +1.68% | 1.41× |
| v22.12.0 | element-children-refresh | 100 | 2.463 | 2.589 | +5.13% | 0.76× |
| v22.12.0 | element-children-refresh | 1000 | 13.843 | 13.716 | -0.92% | 0.60× |
| v22.12.0 | document-name-create | 100 | 12.622 | 1.437 | -88.61% | 1.64× |
| v22.12.0 | document-name-live | 100 | 14.075 | 2.505 | -82.20% | 0.94× |
| v22.12.0 | document-name-cached | 100 | 0.173 | 0.181 | +4.26% | 0.97× |
| v22.12.0 | document-name-miss | 100 | 12.290 | 0.885 | -92.80% | 2.16× |
| v22.12.0 | document-name-create | 1000 | 111.053 | 14.955 | -86.53% | 0.89× |
| v22.12.0 | document-name-live | 1000 | 112.077 | 16.279 | -85.48% | 0.81× |
| v22.12.0 | document-name-cached | 1000 | 0.201 | 0.210 | +4.78% | 0.94× |
| v22.12.0 | document-name-miss | 1000 | 111.853 | 8.185 | -92.68% | 1.53× |

Variación global: -93.11% a +8.05%.
Variación de consultas por nombre: -93.11% a +4.78%.
Variación del control jsdom: -8.42% a +19.48%.
Un cambio positivo indica mayor duración; ratio mayor que 1 favorece rustdom.
La CPU WSL2 se comparte con el host. No atribuir variaciones pequeñas al motor
sin considerar el control y ambos órdenes. No se afirma velocidad universal,
equivalencia estadística, mejora de suites completas ni memoria pico.

- [Muestras agrupadas, percentiles y ambos órdenes](comparison.json).
- [Validación y límites](../../validation/name-queries.md).
- [Inventario y checksums](../../validation/name-queries/evidence.json).
- v24.14.1, baseline: [reporte crudo](./2026-10-20T22-01-30.733Z-linux-x64.json.gz).
- v24.14.1, candidate: [reporte crudo](./2026-10-20T22-02-29.807Z-linux-x64.json.gz).
- v22.12.0, baseline: [reporte crudo](./2026-10-20T22-03-44.261Z-linux-x64.json.gz).
- v22.12.0, candidate: [reporte crudo](./2026-10-20T22-04-50.391Z-linux-x64.json.gz).
- v24.14.1, candidate: [reporte crudo](./2026-10-20T22-05-48.634Z-linux-x64.json.gz).
- v24.14.1, baseline: [reporte crudo](./2026-10-20T22-06-54.267Z-linux-x64.json.gz).
- v22.12.0, candidate: [reporte crudo](./2026-10-20T22-08-01.435Z-linux-x64.json.gz).
- v22.12.0, baseline: [reporte crudo](./2026-10-20T22-09-16.167Z-linux-x64.json.gz).

Gzip preserva sin pérdida los datos grandes. sourceHash identifica código y
harness; runtimeSource y el SHA del addon identifican el motor cargado, incluido
el baseline histórico. El inventario verifica también los bytes descomprimidos.
