# Lecturas de atributos: benchmark antes/después

Se comparan checkpoint-064-id-lookups y el hito de lecturas nativas con jsdom 27.4.0. Las 44 filas de atributos varían entre -71.15% a +14.95%; 9 registran mayor duración. La tabla conserva todas las filas, controles y regresiones. Estas tareas sintéticas no acreditan una aceleración general de Jest/Vitest ni de suites completas.

Las lecturas calificadas con resultado reducen duración entre 22,59% y 30,37%; las de valores largos, entre 67,61% y 71,15%, y las de UTF-16 aislado, entre 54,74% y 56,60%, frente al checkpoint 64. Sigue pendiente attribute-get-miss: Node 22 registra +14,95% con 100 Attrs y +8,96% con 1.000; Node 24 registra +6,88% con 1.000. Los hits por namespace quedan en 0,16–0,82× frente a jsdom según fila, aunque mejoren respecto de rustdom anterior. Estos costos siguen abiertos y no se presentan como rendimiento superior general.

Once tareas públicas miden getAttribute/getAttributeNS, hasAttribute/hasAttributeNS, ausencias, lectura de valores largos de 4.096 unidades y UTF-16 aislado, y title. Cada muestra realiza cien lecturas sobre un Element con 100/1.000 Attrs de namespaces alternados más un title fijo. Las consultas NS seleccionan el último Attr o recorren la lista completa sin encontrarlo. Las consultas por nombre incluyen folding ASCII en un HTML Element. El tamaño cuenta Attrs; inputBytes identifica el bootstrap HTML real de 21 bytes.

Las tareas adicionales de Document miden cien lecturas o cambios de IDs y una inserción pública que registra los 100/1.000 descendientes preparados. Document-name-miss y Document-ID-read ayudan a observar variación de tareas cuyo algoritmo no cambió. Los controles de jsdom muestran el ruido entre etapas; variaciones pequeñas requieren cautela.

Ocho reportes, 32 workers aislados y ambos órdenes baseline → candidato / candidato → baseline. Cada worker realiza tres warmups y nueve muestras; se conservan 36 muestras por fila/motor/etapa/runtime, p95 y extremos. La corrida final se hizo después de las validaciones y sin builds/tests simultáneos. Hardware y toolchains están en los reportes crudos y en [toolchains](../../validation/attribute-reads/toolchains.json).

Se incluye WebIDL, puente y conversión de salida. Setup, validación completa, serialización, limpieza y GC quedan fuera del timer. Se comprueban todos los Attrs, sus valores, namespaces, orden, owners e identidades, además del hash de todo el scope y del documento. La actividad nativa se comprueba antes de las lecturas auxiliares. El benchmark title conserva el fallback null → vacío de su wrapper generado en el host; no mide la nueva proyección vacía del helper attributeReflectionValue ni acredita migrar todo el getter de reflexión.

| Node | Tarea | Attrs/Element | Base ms | Candidato ms | Duración | jsdom/candidato | Control jsdom |
|---|---|---:|---:|---:|---:|---:|---:|
| v22.12.0 | document-name-miss | 100 | 0.8531 | 0.8818 | +3.37% | 2.65× | -5.39% |
| v22.12.0 | document-name-miss | 1000 | 7.9568 | 8.0163 | +0.75% | 1.53× | -2.08% |
| v22.12.0 | document-id-read | 100 | 0.1389 | 0.1337 | -3.72% | 0.78× | -2.64% |
| v22.12.0 | document-id-register | 100 | 0.6858 | 0.6184 | -9.83% | 0.55× | +2.83% |
| v22.12.0 | document-id-change | 100 | 1.0127 | 1.0343 | +2.14% | 0.29× | -1.64% |
| v22.12.0 | document-id-read | 1000 | 0.1131 | 0.1041 | -7.91% | 0.50× | -2.26% |
| v22.12.0 | document-id-register | 1000 | 5.0270 | 3.7854 | -24.70% | 0.62× | -6.23% |
| v22.12.0 | document-id-change | 1000 | 0.9103 | 0.8498 | -6.64% | 0.35× | +6.21% |
| v22.12.0 | attribute-get | 100 | 0.1701 | 0.1317 | -22.59% | 0.49× | -2.18% |
| v22.12.0 | attribute-get-miss | 100 | 0.1151 | 0.1323 | +14.95% | 0.45× | +0.12% |
| v22.12.0 | attribute-get-ns | 100 | 0.4747 | 0.4283 | -9.77% | 0.30× | +4.11% |
| v22.12.0 | attribute-get-ns-miss | 100 | 0.3722 | 0.3607 | -3.11% | 0.77× | +29.14% |
| v22.12.0 | attribute-has | 100 | 0.1440 | 0.1404 | -2.49% | 0.53× | +0.74% |
| v22.12.0 | attribute-has-miss | 100 | 0.1414 | 0.1358 | -3.97% | 0.51× | -2.48% |
| v22.12.0 | attribute-has-ns | 100 | 0.4606 | 0.4420 | -4.04% | 0.57× | +0.71% |
| v22.12.0 | attribute-has-ns-miss | 100 | 0.3871 | 0.3774 | -2.51% | 0.64× | +4.79% |
| v22.12.0 | attribute-get-long | 100 | 0.6787 | 0.1959 | -71.15% | 0.33× | +1.54% |
| v22.12.0 | attribute-get-utf16 | 100 | 0.6671 | 0.2917 | -56.28% | 0.22× | -1.31% |
| v22.12.0 | attribute-reflection | 100 | 0.2216 | 0.1772 | -20.04% | 1.42× | +60.01% |
| v22.12.0 | attribute-get | 1000 | 0.1854 | 0.1376 | -25.78% | 0.43× | -5.65% |
| v22.12.0 | attribute-get-miss | 1000 | 0.1187 | 0.1294 | +8.96% | 0.45× | +0.17% |
| v22.12.0 | attribute-get-ns | 1000 | 2.9393 | 2.9259 | -0.46% | 0.16× | -8.43% |
| v22.12.0 | attribute-get-ns-miss | 1000 | 2.0631 | 2.1110 | +2.32% | 0.20× | +4.52% |
| v22.12.0 | attribute-has | 1000 | 0.1327 | 0.1277 | -3.73% | 0.50× | +5.33% |
| v22.12.0 | attribute-has-miss | 1000 | 0.1253 | 0.1236 | -1.38% | 0.48× | +8.80% |
| v22.12.0 | attribute-has-ns | 1000 | 2.8730 | 2.7620 | -3.86% | 0.55× | +3.59% |
| v22.12.0 | attribute-has-ns-miss | 1000 | 1.9816 | 2.0719 | +4.56% | 0.60× | -1.12% |
| v22.12.0 | attribute-get-long | 1000 | 0.6634 | 0.1931 | -70.89% | 0.32× | +7.64% |
| v22.12.0 | attribute-get-utf16 | 1000 | 0.6262 | 0.2816 | -55.04% | 0.21× | -5.84% |
| v22.12.0 | attribute-reflection | 1000 | 0.6373 | 0.5938 | -6.81% | 0.62× | -0.44% |
| v24.14.1 | document-name-miss | 100 | 0.8701 | 0.8259 | -5.08% | 2.90× | +6.86% |
| v24.14.1 | document-name-miss | 1000 | 7.0315 | 7.0607 | +0.42% | 1.89× | +1.96% |
| v24.14.1 | document-id-read | 100 | 0.1396 | 0.1329 | -4.75% | 0.62× | +3.65% |
| v24.14.1 | document-id-register | 100 | 0.7184 | 0.6402 | -10.89% | 0.64× | +1.98% |
| v24.14.1 | document-id-change | 100 | 0.9504 | 1.0215 | +7.48% | 0.46× | +6.64% |
| v24.14.1 | document-id-read | 1000 | 0.1255 | 0.1252 | -0.19% | 0.68× | +4.52% |
| v24.14.1 | document-id-register | 1000 | 4.5172 | 3.4384 | -23.88% | 0.65× | +2.19% |
| v24.14.1 | document-id-change | 1000 | 0.9154 | 0.9184 | +0.33% | 0.42× | +2.78% |
| v24.14.1 | attribute-get | 100 | 0.1807 | 0.1277 | -29.33% | 0.52× | +3.05% |
| v24.14.1 | attribute-get-miss | 100 | 0.1300 | 0.1226 | -5.74% | 0.49× | +8.31% |
| v24.14.1 | attribute-get-ns | 100 | 0.5030 | 0.4120 | -18.10% | 0.82× | -3.28% |
| v24.14.1 | attribute-get-ns-miss | 100 | 0.3658 | 0.3537 | -3.31% | 0.96× | +1.75% |
| v24.14.1 | attribute-has | 100 | 0.1516 | 0.1396 | -7.96% | 0.52× | +0.72% |
| v24.14.1 | attribute-has-miss | 100 | 0.1460 | 0.1388 | -4.87% | 0.49× | +1.54% |
| v24.14.1 | attribute-has-ns | 100 | 0.4241 | 0.4249 | +0.18% | 0.51× | -5.42% |
| v24.14.1 | attribute-has-ns-miss | 100 | 0.3708 | 0.3642 | -1.77% | 0.60× | +2.82% |
| v24.14.1 | attribute-get-long | 100 | 0.6515 | 0.2016 | -69.06% | 0.32× | +2.92% |
| v24.14.1 | attribute-get-utf16 | 100 | 0.6518 | 0.2829 | -56.60% | 0.23× | +1.09% |
| v24.14.1 | attribute-reflection | 100 | 0.2358 | 0.1737 | -26.33% | 1.93× | -0.57% |
| v24.14.1 | attribute-get | 1000 | 0.1719 | 0.1197 | -30.37% | 0.58× | +2.70% |
| v24.14.1 | attribute-get-miss | 1000 | 0.1106 | 0.1182 | +6.88% | 0.52× | +0.89% |
| v24.14.1 | attribute-get-ns | 1000 | 2.5887 | 2.5444 | -1.71% | 0.18× | +1.73% |
| v24.14.1 | attribute-get-ns-miss | 1000 | 1.7437 | 1.7789 | +2.02% | 0.24× | +9.49% |
| v24.14.1 | attribute-has | 1000 | 0.1242 | 0.1212 | -2.43% | 0.54× | +0.96% |
| v24.14.1 | attribute-has-miss | 1000 | 0.1177 | 0.1196 | +1.68% | 0.52× | +3.40% |
| v24.14.1 | attribute-has-ns | 1000 | 2.6073 | 2.4987 | -4.16% | 0.59× | -2.86% |
| v24.14.1 | attribute-has-ns-miss | 1000 | 1.7575 | 1.8050 | +2.71% | 0.68× | -2.87% |
| v24.14.1 | attribute-get-long | 1000 | 0.5930 | 0.1921 | -67.61% | 0.34× | -1.91% |
| v24.14.1 | attribute-get-utf16 | 1000 | 0.5687 | 0.2574 | -54.74% | 0.27× | +2.87% |
| v24.14.1 | attribute-reflection | 1000 | 0.5819 | 0.5370 | -7.72% | 0.68× | +2.63% |

Un valor positivo en Duración indica regresión. jsdom/candidato mayor que uno favorece rustdom. La memoria post-GC de los workers no es memoria pico ni prueba de ausencia de fugas. La [comparación](comparison.json) conserva distribuciones y resultados por orden; los ocho JSON originales están comprimidos sin pérdida y sus hashes se verifican en la [evidencia](../../validation/attribute-reads/evidence.json).

El [piloto UTF-16 descartado](../utf16-input-pilot/README.md) conserva sus muestras por separado. No se incorporó aquella conversión inline; sus corridas exploratorias no se mezclan con esta comparación.
