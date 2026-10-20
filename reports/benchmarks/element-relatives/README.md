# Hijos y hermanos Element: mediciones antes y después

Baseline: PR 72 corregido (`2ae5f2c`), addon `7f24a7e9…`. Se verificaron los
567 archivos del dist validado antes de trasladarlo al baseline. Ambos addons
usan Rust 1.99.1 release con thin LTO; el baseline recorre estos enlaces y
filtra Element en JavaScript, y el candidato ejecuta ambos algoritmos en Rust.
Referencia independiente: jsdom 27.4.0. Las factories, WebIDL e invalidación
mantienen su integración actual; el runtime continúa siendo híbrido.

Máquina: 13th Gen Intel(R) Core(TM) i7-1360P; 16 CPUs lógicas; 6.6.87.2-microsoft-standard-WSL2.

Cada entrada contiene 100 o 1.000 nodos físicos. children alterna Element de
namespaces distintos y Text/Comment; las lecturas escalares colocan un Element
al otro extremo de una cadena de nodos no Element, o dos Element a sus extremos.
Cada muestra consume cien lecturas públicas. El refresco incluye invalidar un
atributo y leer length/item de la colección retenida; el modo cached no invalida.
Se comprueba el contador propio antes de las lecturas auxiliares, todas las
identidades físicas, resultados y el hash completo fuera del temporizador.
Preparación, importación, validación, cierre y GC quedan fuera del tiempo medido.

Ocho reportes, 32 workers aislados y 36 muestras por fila/motor/etapa/runtime.
Cada proceso hace tres warmups y nueve muestras medidas. Se invierten tanto las
etapas baseline/candidato como el orden de motores. Se guardan todas las filas,
muestras, percentiles, memoria posterior al GC y ambas repeticiones. La CPU WSL2
se comparte con el host; estos patrones no miden suites completas ni memoria pico.

| Node | Operación | Nodos físicos | Antes (ms) | Después (ms) | Variación | jsdom/rustdom final |
|---|---|---:|---:|---:|---:|---:|
| v24.14.1 | element-children-refresh | 100 | 3.154 | 2.492 | -21.01% | 0.90× |
| v24.14.1 | element-children-cached | 100 | 0.589 | 0.578 | -1.81% | 1.59× |
| v24.14.1 | element-first-child | 100 | 1.011 | 0.242 | -76.10% | 4.07× |
| v24.14.1 | element-last-child | 100 | 0.953 | 0.246 | -74.16% | 3.91× |
| v24.14.1 | element-next-sibling | 100 | 0.984 | 0.238 | -75.86% | 4.25× |
| v24.14.1 | element-previous-sibling | 100 | 0.954 | 0.246 | -74.21% | 4.06× |
| v24.14.1 | element-children-refresh | 1000 | 17.567 | 14.393 | -18.07% | 0.53× |
| v24.14.1 | element-children-cached | 1000 | 2.859 | 2.834 | -0.88% | 1.13× |
| v24.14.1 | element-first-child | 1000 | 3.773 | 1.773 | -53.00% | 2.08× |
| v24.14.1 | element-last-child | 1000 | 3.869 | 1.736 | -55.14% | 2.22× |
| v24.14.1 | element-next-sibling | 1000 | 3.734 | 1.792 | -51.99% | 2.15× |
| v24.14.1 | element-previous-sibling | 1000 | 3.707 | 1.786 | -51.82% | 2.02× |
| v22.12.0 | element-children-refresh | 100 | 3.820 | 3.014 | -21.11% | 0.65× |
| v22.12.0 | element-children-cached | 100 | 0.606 | 0.655 | +8.17% | 1.52× |
| v22.12.0 | element-first-child | 100 | 1.030 | 0.251 | -75.67% | 2.88× |
| v22.12.0 | element-last-child | 100 | 0.961 | 0.257 | -73.26% | 1.87× |
| v22.12.0 | element-next-sibling | 100 | 1.056 | 0.246 | -76.72% | 1.99× |
| v22.12.0 | element-previous-sibling | 100 | 0.976 | 0.274 | -71.92% | 2.02× |
| v22.12.0 | element-children-refresh | 1000 | 18.226 | 14.345 | -21.30% | 0.58× |
| v22.12.0 | element-children-cached | 1000 | 3.346 | 3.240 | -3.18% | 1.45× |
| v22.12.0 | element-first-child | 1000 | 4.922 | 1.885 | -61.70% | 3.30× |
| v22.12.0 | element-last-child | 1000 | 4.990 | 1.889 | -62.15% | 3.40× |
| v22.12.0 | element-next-sibling | 1000 | 4.858 | 1.917 | -60.54% | 2.94× |
| v22.12.0 | element-previous-sibling | 1000 | 5.126 | 1.885 | -63.23% | 3.13× |

Variación frente al baseline: -76.72% a +8.17%.
Variación del control jsdom: -12.46% a +26.09%.
Un cambio positivo indica mayor duración. Ratio mayor que 1 favorece rustdom.
No se excluyen regresiones ni se afirma una mejora universal.

- [Comparación, percentiles y repeticiones](comparison.json).
- [Validación y límites](../../validation/element-relatives.md).
- [Inventario, fuentes y checksums](../../validation/element-relatives/evidence.json).
- v24.14.1, baseline: [reporte crudo](./2026-10-20T21-08-55.661Z-linux-x64.json.gz).
- v24.14.1, candidate: [reporte crudo](./2026-10-20T21-09-58.731Z-linux-x64.json.gz).
- v22.12.0, baseline: [reporte crudo](./2026-10-20T21-11-11.548Z-linux-x64.json.gz).
- v22.12.0, candidate: [reporte crudo](./2026-10-20T21-12-24.195Z-linux-x64.json.gz).
- v24.14.1, candidate: [reporte crudo](./2026-10-20T21-13-27.091Z-linux-x64.json.gz).
- v24.14.1, baseline: [reporte crudo](./2026-10-20T21-14-30.235Z-linux-x64.json.gz).
- v22.12.0, candidate: [reporte crudo](./2026-10-20T21-15-41.705Z-linux-x64.json.gz).
- v22.12.0, baseline: [reporte crudo](./2026-10-20T21-16-54.528Z-linux-x64.json.gz).

Los datos grandes se comprimen con gzip sin pérdida. sourceHash identifica el
harness y las fuentes medidas del candidato; runtimeSource y el SHA del addon
identifican el motor cargado. El inventario conserva también el dist del baseline,
los hashes del contenido original y el paquete instalado en ambos Node.
