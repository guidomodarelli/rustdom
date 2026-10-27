# Memoria del candidato C

Prueba real con el addon afbf5e85, Linux/WSL x64; proceso nuevo por modo,
tres lotes de warmup y ocho medidos, cuarenta operaciones por lote.
Se exigieron dos endpoints claros de Document y Window por separado,
con hasta doce rondas asíncronas y diez segundos, y baselines nativos.

| Node | Modo | Document liberados | Window liberados | Δ heap MiB | Δ RSS MiB |
| --- | --- | ---: | ---: | ---: | ---: |
| v22.12.0 | jsdom | 1762 | 882 | 2.39 | 2.93 |
| v22.12.0 | rustdom | 1762 | 882 | 1.43 | 6.27 |
| v22.12.0 | native | 0 | 0 | 0.02 | 0.25 |
| v22.12.0 | vitest | 1760 | 880 | 2.84 | 1.51 |
| v22.12.0 | vitest-vm | 1760 | 880 | 2.46 | 1.71 |
| v24.14.1 | jsdom | 1762 | 882 | 2.78 | 5.91 |
| v24.14.1 | rustdom | 1762 | 882 | 1.98 | 11.39 |
| v24.14.1 | native | 0 | 0 | 0.02 | 0.25 |
| v24.14.1 | vitest | 1760 | 880 | 4.10 | 25.42 |
| v24.14.1 | vitest-vm | 1760 | 880 | 3.74 | 50.33 |

En native los dos contadores WeakRef son cero porque ese modo observa recursos
nativos, no wrappers de Document/Window. Las muestras y trazas de cada intento
se conservan en el archivo funcional, junto con las pruebas específicas de
callbacks, observers, abort, constructores fallidos, workers y teardown.

Memcheck del guard: cero errores y bytes definite/indirect, 48 possible y
548 reachable del harness/std. Las cuatro pruebas reales del sampler observan
otros 768 Document y 768 Window, con 256 endpoints finales requeridos claros.

No son mediciones de memoria pico ni prueba de ausencia universal de fugas.
RSS incluye retención del allocator y no se interpreta por sí sola como fuga.
La comparación formal de rendimiento con C todavía no se ejecutó.

Reportes completos y hashes: [inline-candidate](../../validation/native-class-ownership/inline-candidate/README.md).
Workers y límites: [paired-inline-sampler](../../validation/native-class-ownership/paired-inline-sampler/README.md).
