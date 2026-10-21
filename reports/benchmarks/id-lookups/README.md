# IDs de Document y SVG: antes y después

Baseline: checkpoint-063-fragment-id, main `60f7cb6`, árbol idéntico al
head revisado `859c111`. Se reutiliza su dist validado y addon `69577fc6…`.
Ambas versiones usan Rust 1.99.1 release con thin LTO. El baseline mantiene
el índice de Document y el recorrido SVG en JavaScript; el candidato los
ejecuta en Rust. La referencia independiente es jsdom 27.4.0. El runtime
sigue siendo híbrido: WebIDL, factories y efectos generales conservan el host.

Máquina: 13th Gen Intel(R) Core(TM) i7-1360P; 16 CPUs lógicas; 6.6.87.2-microsoft-standard-WSL2.

Cada fila prepara 100/1.000 Element de namespace HTML y extranjero bajo un
section o svg. Lectura y ausencia consultan el índice de Document; registro
mide una única inserción pública del subárbol preparado con IDs distintos.
Cambios ejecuta cien setAttributeNS(null, "id", valor) alternados. Las otras
filas consumen cien búsquedas SVG: propio root, último descendiente o atributo
ID vacío explícito en el último descendiente. Los atributos p:id con valor
ausente deben ignorarse. Los tamaños excluyen el root; todos los hijos tienen
tres atributos. No son mediciones de nodos con cientos de atributos.

Document-name miss y fragment-ID last conservan sus algoritmos nativos del
checkpoint anterior y actúan como controles. inputBytes representa el
bootstrap HTML real de 21 bytes y no los bytes de asignación de los fixtures.
Preparación, importación, checks, serialización del hash, limpieza, cierre y
GC quedan fuera del tiempo. Se verifican contadores nativos antes de las
lecturas auxiliares, todas las identidades y atributos, y el hash XML del
scope completo además del documento. Cada operación pública incluye el
costo del puente, WebIDL y los efectos del host que correspondan.

Ocho reportes, 32 workers y 36 muestras por fila/motor/etapa/runtime.
Cada proceso ejecuta tres warmups y nueve muestras; se alternan etapas y
motores. Se conservan ambos órdenes, percentiles, outliers y muestras de
memoria después de GC. Los CLI previos prueban corrección y están excluidos
de estas comparaciones finales.

| Node | Operación | Tamaño | Antes ms | Después ms | Variación | jsdom/rustdom final |
|---|---|---:|---:|---:|---:|---:|
| v24.14.1 | document-name-miss | 100 | 0.852 | 0.821 | -3.73% | 2.74× |
| v24.14.1 | document-name-miss | 1000 | 7.449 | 7.077 | -5.00% | 1.95× |
| v24.14.1 | fragment-id-last | 100 | 0.507 | 0.488 | -3.77% | 4.90× |
| v24.14.1 | fragment-id-last | 1000 | 6.479 | 6.614 | +2.09% | 1.68× |
| v24.14.1 | document-id-read | 100 | 0.084 | 0.135 | +59.78% | 0.59× |
| v24.14.1 | document-id-miss | 100 | 0.051 | 0.124 | +141.82% | 0.42× |
| v24.14.1 | document-id-register | 100 | 0.643 | 0.708 | +10.13% | 0.51× |
| v24.14.1 | document-id-change | 100 | 1.008 | 1.050 | +4.12% | 0.35× |
| v24.14.1 | svg-id-self | 100 | 0.288 | 0.131 | -54.60% | 0.93× |
| v24.14.1 | svg-id-last | 100 | 12.408 | 0.684 | -94.49% | 3.56× |
| v24.14.1 | svg-id-empty | 100 | 12.480 | 0.480 | -96.16% | 4.59× |
| v24.14.1 | document-id-read | 1000 | 0.082 | 0.139 | +69.02% | 0.51× |
| v24.14.1 | document-id-miss | 1000 | 0.051 | 0.111 | +118.92% | 0.47× |
| v24.14.1 | document-id-register | 1000 | 4.340 | 4.444 | +2.39% | 0.49× |
| v24.14.1 | document-id-change | 1000 | 0.858 | 0.938 | +9.35% | 0.37× |
| v24.14.1 | svg-id-self | 1000 | 0.205 | 0.114 | -44.47% | 0.94× |
| v24.14.1 | svg-id-last | 1000 | 110.884 | 8.440 | -92.39% | 1.54× |
| v24.14.1 | svg-id-empty | 1000 | 112.153 | 6.319 | -94.37% | 1.91× |
| v22.12.0 | document-name-miss | 100 | 0.896 | 0.881 | -1.60% | 2.79× |
| v22.12.0 | document-name-miss | 1000 | 7.805 | 8.013 | +2.67% | 1.50× |
| v22.12.0 | fragment-id-last | 100 | 0.498 | 0.497 | -0.27% | 4.33× |
| v22.12.0 | fragment-id-last | 1000 | 7.446 | 7.443 | -0.04% | 1.73× |
| v22.12.0 | document-id-read | 100 | 0.111 | 0.132 | +18.62% | 0.78× |
| v22.12.0 | document-id-miss | 100 | 0.039 | 0.110 | +179.48% | 0.37× |
| v22.12.0 | document-id-register | 100 | 0.669 | 0.714 | +6.71% | 0.52× |
| v22.12.0 | document-id-change | 100 | 0.998 | 1.032 | +3.39% | 0.31× |
| v22.12.0 | svg-id-self | 100 | 0.226 | 0.134 | -40.68% | 0.69× |
| v22.12.0 | svg-id-last | 100 | 11.493 | 0.752 | -93.46% | 2.04× |
| v22.12.0 | svg-id-empty | 100 | 11.379 | 0.503 | -95.58% | 2.91× |
| v22.12.0 | document-id-read | 1000 | 0.053 | 0.104 | +93.95% | 0.46× |
| v22.12.0 | document-id-miss | 1000 | 0.035 | 0.091 | +162.09% | 0.38× |
| v22.12.0 | document-id-register | 1000 | 4.640 | 5.041 | +8.66% | 0.49× |
| v22.12.0 | document-id-change | 1000 | 0.834 | 0.894 | +7.17% | 0.32× |
| v22.12.0 | svg-id-self | 1000 | 0.205 | 0.129 | -37.18% | 0.65× |
| v22.12.0 | svg-id-last | 1000 | 110.115 | 9.530 | -91.35% | 1.25× |
| v22.12.0 | svg-id-empty | 1000 | 110.381 | 7.003 | -93.66% | 1.67× |

Variación de las siete tareas migradas: -96.16% a +179.48%.
Variación global, incluidos los controles: -96.16% a +179.48%.
Variación de jsdom entre etapas: -15.59% a +28.10%.
Un cambio positivo significa más tiempo; ratio mayor que uno favorece
rustdom. WSL2 comparte CPU con el host: las diferencias pequeñas requieren
considerar controles y ambos órdenes. El tiempo incluye el puente N-API
de las lecturas; se publican las regresiones. No se afirma velocidad universal,
equivalencia estadística, mejora de suites completas ni memoria pico.

- [Muestras y ambos órdenes](comparison.json).
- [Validación y límites](../../validation/id-lookups.md).
- [Inventario y checksums](../../validation/id-lookups/evidence.json).
- v24.14.1, baseline: [reporte crudo](./2026-10-21T00-14-57.708Z-linux-x64.json.gz).
- v24.14.1, candidate: [reporte crudo](./2026-10-21T00-16-15.056Z-linux-x64.json.gz).
- v22.12.0, baseline: [reporte crudo](./2026-10-21T00-18-25.568Z-linux-x64.json.gz).
- v22.12.0, candidate: [reporte crudo](./2026-10-21T00-19-56.399Z-linux-x64.json.gz).
- v24.14.1, candidate: [reporte crudo](./2026-10-21T00-21-12.959Z-linux-x64.json.gz).
- v24.14.1, baseline: [reporte crudo](./2026-10-21T00-23-10.825Z-linux-x64.json.gz).
- v22.12.0, candidate: [reporte crudo](./2026-10-21T00-24-39.662Z-linux-x64.json.gz).
- v22.12.0, baseline: [reporte crudo](./2026-10-21T00-26-51.023Z-linux-x64.json.gz).

Gzip conserva sin pérdida los datos grandes; el inventario verifica también
los bytes originales descomprimidos. sourceHash identifica código y harness;
runtimeSource y el SHA del addon identifican el motor cargado.
