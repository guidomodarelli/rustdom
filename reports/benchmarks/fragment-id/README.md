# getElementById de fragmentos y ShadowRoot: antes y después

Baseline: checkpoint-062-name-queries, main `e5a2daa`, árbol idéntico al
head revisado `645f2ec`. Se reutiliza su dist validado y addon `ca4c8081…`.
Ambos motores Rust usan Rust 1.99.1 release con thin LTO. El baseline recorre
y filtra atributos en JavaScript; el candidato hace la búsqueda y comparación
prestada en Rust y para en el primer match. La referencia es jsdom 27.4.0.
WebIDL, factories y owners conservan el host actual; el runtime sigue híbrido.

Máquina: 13th Gen Intel(R) Core(TM) i7-1360P; 16 CPUs lógicas; 6.6.87.2-microsoft-standard-WSL2.

Cada muestra consume cien consultas públicas sobre 100/1.000 Element de
namespace HTML y extranjero. Se busca el primer miembro, el último, un ID
ausente en DocumentFragment o el último miembro de ShadowRoot. Los atributos
p:id con el valor ausente deben ignorarse. Document.getElementsByName miss
conserva su recorrido nativo anterior y actúa como control sin cambios.

Cada Element del fixture tiene tres atributos; estas filas no miden árboles
con cientos de atributos por nodo.

Los fragmentos están separados del documento; el host shadow se añade al body.
inputBytes identifica el bootstrap HTML real de 21 bytes; el tamaño de fila
cuenta los Element preparados y no representa bytes de asignación del DOM.
La preparación, importación, validación, serialización del hash, cierre y GC
quedan fuera del temporizador. Se comprueban contadores nativos antes de las
lecturas auxiliares, todas las identidades/atributos y el resultado completo.
El hash incluye la serialización XML íntegra del fragmento o shadow root,
además del documento, de modo que los árboles separados también se comparan.

Ocho reportes, 32 workers y 36 muestras por fila/motor/etapa/runtime. Cada
proceso hace tres warmups y nueve muestras; se alternan etapas y motores.
Se conservan todas las filas, outliers, percentiles y muestras después de GC.
Los smoke tests previos validan el CLI; sus tiempos se archivan como
diagnóstico y quedan excluidos de estas comparaciones finales.

| Node | Operación | Tamaño | Antes ms | Después ms | Variación | jsdom/rustdom final |
|---|---|---:|---:|---:|---:|---:|
| v24.14.1 | document-name-miss | 100 | 0.851 | 0.828 | -2.66% | 2.89× |
| v24.14.1 | document-name-miss | 1000 | 7.083 | 7.273 | +2.68% | 1.89× |
| v24.14.1 | fragment-id-first | 100 | 0.268 | 0.132 | -50.63% | 1.01× |
| v24.14.1 | fragment-id-last | 100 | 11.831 | 0.476 | -95.97% | 4.91× |
| v24.14.1 | fragment-id-miss | 100 | 11.612 | 0.466 | -95.99% | 5.13× |
| v24.14.1 | shadow-id-last | 100 | 12.049 | 0.493 | -95.91% | 4.30× |
| v24.14.1 | fragment-id-first | 1000 | 0.247 | 0.121 | -50.96% | 1.05× |
| v24.14.1 | fragment-id-last | 1000 | 109.151 | 6.586 | -93.97% | 1.78× |
| v24.14.1 | fragment-id-miss | 1000 | 110.445 | 6.547 | -94.07% | 1.67× |
| v24.14.1 | shadow-id-last | 1000 | 110.777 | 6.860 | -93.81% | 1.59× |
| v22.12.0 | document-name-miss | 100 | 0.897 | 0.902 | +0.52% | 2.66× |
| v22.12.0 | document-name-miss | 1000 | 7.798 | 7.974 | +2.25% | 1.56× |
| v22.12.0 | fragment-id-first | 100 | 0.248 | 0.129 | -48.05% | 1.01× |
| v22.12.0 | fragment-id-last | 100 | 10.846 | 0.521 | -95.19% | 3.31× |
| v22.12.0 | fragment-id-miss | 100 | 11.021 | 0.517 | -95.31% | 3.11× |
| v22.12.0 | shadow-id-last | 100 | 10.756 | 0.518 | -95.18% | 2.27× |
| v22.12.0 | fragment-id-first | 1000 | 0.274 | 0.139 | -49.37% | 0.74× |
| v22.12.0 | fragment-id-last | 1000 | 113.385 | 7.479 | -93.40% | 1.82× |
| v22.12.0 | fragment-id-miss | 1000 | 115.328 | 7.485 | -93.51% | 1.74× |
| v22.12.0 | shadow-id-last | 1000 | 115.000 | 7.502 | -93.48% | 1.63× |

Variación global: -95.99% a +2.68%.
Variación de consultas por ID: -95.99% a -48.05%.
Variación del control jsdom: -20.21% a +8.54%.
Un cambio positivo significa mayor duración; ratio mayor que 1 favorece rustdom.
WSL2 comparte CPU con el host. No atribuir variaciones pequeñas al motor sin
considerar ambos órdenes y controles. No se afirma velocidad universal,
equivalencia estadística, mejora de suites completas ni memoria pico.

- [Muestras, percentiles y ambos órdenes](comparison.json).
- [Validación y límites](../../validation/fragment-id.md).
- [Inventario y checksums](../../validation/fragment-id/evidence.json).
- v24.14.1, baseline: [reporte crudo](./2026-10-20T22-51-02.459Z-linux-x64.json.gz).
- v24.14.1, candidate: [reporte crudo](./2026-10-20T22-51-41.971Z-linux-x64.json.gz).
- v22.12.0, baseline: [reporte crudo](./2026-10-20T22-52-36.577Z-linux-x64.json.gz).
- v22.12.0, candidate: [reporte crudo](./2026-10-20T22-53-23.045Z-linux-x64.json.gz).
- v24.14.1, candidate: [reporte crudo](./2026-10-20T22-54-03.393Z-linux-x64.json.gz).
- v24.14.1, baseline: [reporte crudo](./2026-10-20T22-54-51.979Z-linux-x64.json.gz).
- v22.12.0, candidate: [reporte crudo](./2026-10-20T22-55-38.137Z-linux-x64.json.gz).
- v22.12.0, baseline: [reporte crudo](./2026-10-20T22-56-32.577Z-linux-x64.json.gz).

Gzip conserva sin pérdida los datos grandes. sourceHash identifica código y
harness; runtimeSource y el SHA del addon identifican el motor cargado.
El inventario comprueba también los bytes originales descomprimidos.
