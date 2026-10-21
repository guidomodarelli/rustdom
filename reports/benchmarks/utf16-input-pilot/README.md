# Piloto descartado: conversión de inputs UTF-16

La conversión inline de strings cortos no mostró una mejora consistente en Node 22.12.0 y 24.14.1. No se incorporó su código al runtime. La base corresponde al PR 76 integrado en checkpoint-064-id-lookups; el prototipo usa el addon indicado en comparison.json.

Estas son mediciones de diagnóstico: un orden baseline → prototipo, cuatro workers alternando motores por reporte y dieciocho muestras por fila/motor/etapa/runtime. Faltó el orden inverso; hubo operaciones Git de integración durante el piloto. No constituyen evidencia final balanceada ni una mejora general. Un valor positivo indica mayor duración.

| Node | Tarea | Element | Cambio rustdom | Cambio del control jsdom |
|---|---|---:|---:|---:|
| v24.14.1 | document-name-miss | 100 | 6.90% | 1.19% |
| v24.14.1 | document-name-miss | 1000 | 7.10% | 3.56% |
| v24.14.1 | document-id-read | 100 | 13.84% | -0.09% |
| v24.14.1 | document-id-miss | 100 | 4.41% | 3.68% |
| v24.14.1 | document-id-register | 100 | 1.91% | 9.80% |
| v24.14.1 | document-id-change | 100 | 4.45% | 12.44% |
| v24.14.1 | document-id-read | 1000 | -3.84% | 0.74% |
| v24.14.1 | document-id-miss | 1000 | -4.65% | 14.79% |
| v24.14.1 | document-id-register | 1000 | 3.60% | 3.96% |
| v24.14.1 | document-id-change | 1000 | -0.36% | 7.83% |
| v22.12.0 | document-name-miss | 100 | 9.71% | 9.32% |
| v22.12.0 | document-name-miss | 1000 | 1.34% | 6.57% |
| v22.12.0 | document-id-read | 100 | -4.08% | 5.75% |
| v22.12.0 | document-id-miss | 100 | 14.33% | 32.05% |
| v22.12.0 | document-id-register | 100 | 3.24% | 0.85% |
| v22.12.0 | document-id-change | 100 | 2.55% | -5.07% |
| v22.12.0 | document-id-read | 1000 | -2.25% | -5.31% |
| v22.12.0 | document-id-miss | 1000 | 4.64% | -3.48% |
| v22.12.0 | document-id-register | 1000 | -3.49% | 0.33% |
| v22.12.0 | document-id-change | 1000 | -1.19% | 1.18% |

Se preservan muestras crudas, hashes originales y comprimidos, perfiles iniciales, fuentes descartadas y validaciones focales. No se ejecutaron gates completos, Memcheck ni instalación del prototipo; tampoco se midió el fallback de strings largos. Los perfiles incluyen overhead del profiler y el nombre compartido del thunk nativo no identifica por sí solo el costo de conversión. Esta reserva evita presentar una hipótesis como un hallazgo de rendimiento.
