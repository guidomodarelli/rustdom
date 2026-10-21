# Resultados con warmup revisado

Node 22 completó 208 procesos A/A, 208 A/B y 52 descriptivos contra jsdom. Node 24 completó 208 A/A y se detuvo sin A/B ni referencia al fallar su calibración. Cada fila de A/A y A/B conserva 256 muestras por etiqueta. La verificación contrasta cada stdout crudo con el índice, longitudes de warmup/muestras, contadores nativos y referencias temporales.

Node 22 calibra dentro de ±2% y pasa el gate de +5% en todas las filas (máximo +2,522%). Node 24 no calibra en dos filas de tamaño uno. El hito no tiene aceptación global: se conserva variación entre procesos y mitades, y el siguiente control de Node 24 está predeclarado en hosted-protocol.md. No certifica otras máquinas, operaciones sobre documentos recién creados ni mejora general sobre jsdom.

| Tarea | Rows | A/A Node 22 | A/B Node 22 | A/A Node 24 | A/B Node 24 |
| --- | ---: | ---: | ---: | ---: | ---: |
| xml-serialize | 100 | 0.23% | 0.46% | -0.46% | — |
| xml-inner-serialize | 100 | 0.04% | 1.17% | 0.29% | — |
| xml-document-serialize | 100 | -1.47% | 0.45% | -1.82% | — |
| xml-serialize-error | 100 | -1.56% | -0.58% | 1.37% | — |
| xml-serialize | 1000 | -1.05% | 0.59% | -1.15% | — |
| xml-inner-serialize | 1000 | 0.01% | 0.29% | 0.10% | — |
| xml-document-serialize | 1000 | -1.29% | 1.24% | -0.97% | — |
| xml-serialize-error | 1000 | 0.48% | -0.92% | -1.68% | — |
| xml-serialize | 1 | -0.91% | -1.12% | 2.84% | — |
| xml-serialize | 16 | -0.15% | 0.18% | 0.75% | — |
| xml-serializer-getter-error | 1 | 1.16% | 2.52% | 2.69% | — |
| xml-serializer-getter-error | 100 | 1.13% | -0.87% | 0.02% | — |
| xml-serializer-getter-error | 1000 | -0.76% | 1.33% | -0.10% | — |

La referencia descriptiva contra jsdom se conserva completa en los JSON. Los pilotos que no calibraron permanecen publicados; sus datos no se incorporan a esta aceptación.

Harness: `0347c53706ce66068fdc5151c6d72cc101a32b98e8dd7c3aae1be1cf54de06be`. Baseline: `10ebf630ccc70bf2ac94fec4c4a2e8ba2aaacb90070c4f229dabcde164a96803`. Candidato: `e178142421fa9fc4b3b30525b1fae3d7a6eac8ffb9123711d09fbc915cda1a01`.
