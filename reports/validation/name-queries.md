# Document.getElementsByName en Rust

El hito migra el recorrido físico de descendientes de Document y el filtro exacto del atributo name sin namespace a Rust. Reutiliza el recorrido acotado de colecciones y un lector prestado de atributos canónicos, compartido con clases y HTMLCollection. No hay wildcard ni normalización de mayúsculas; se conservan valores vacíos, UTF-16, namespaces extranjeros y el orden del árbol.

El puente conserva identidades y WebIDL. NodeList, su owner y su invalidación perezosa siguen usando la integración actual; shadow roots y template.content conservan sus scopes físicos. El runtime continúa siendo híbrido: este hito no completa factories, WebIDL ni todas las APIs de Document.

Base medida: checkpoint-061-element-relatives, main 55e2cb8, cuyo árbol es idéntico al head revisado 0921ab0 del PR 73. foundation/ conserva su integración, revisión limpia y ocho checks. Se reutiliza su addon f5ae22cf… como baseline. La rama actual es feature/native-name-queries; verificar el PR remoto antes de asumir integración.

| Validación | Resultado |
|---|---|
| Rust 1.98.1 / 1.99.1 | Clippy y 285 tests por versión |
| Node 22.12.0 / 24.14.1 | 3.419 contratos, Jest 21, Vitest 32 y VM 32 por versión |
| Contratos de nombres | 54 diferenciales previos pasaron en el baseline; 61 finales por Node |
| Focal final con GC | 62 tests por Node, con 52 escenarios de memoria |
| Harness de benchmarks | 72 tests por Node; ocho nuevos sobre ambos motores reales |
| CLI real del worker | Cuatro workers y ocho filas por Node, inputBytes 21 y resultados iguales |
| Paquete instalado | 20 controles por Node con npm/pnpm, mismo archivo |
| HTML5 | 1.784 comparables por Node; exclusiones conservadas |
| WPT v24.14.1 | 236 fixtures y 82982 resultados en paridad; 1202 fallos de estándar compartidos |
| WPT v22.12.0 | 236 fixtures y 82982 resultados en paridad; 1202 fallos de estándar compartidos |

El total WPT combina la ejecución de release de 221 fixtures con 15 fixtures suplementarios de nombres, sobre el mismo código de producto; no fue un único comando local de 236 fixtures. Los nuevos archivos upstream conservan sus bytes, Git blob y SHA-256 en el mismo revision fijado. Sus 43 resultados por Node incluyen dos fallos de namespaces compartidos con jsdom. El manifest preserva todos los hashes/suites/exclusiones anteriores y agrega la suite document-name-queries. WPT mantiene complete:false y el bootstrap bloqueado de Range-deleteContents; la paridad no certifica todos los estándares.

Los diferenciales cubren HTML/quirks/XML, default/VM, valores literales y UTF-16, namespaces, adopción, Attr directo, mutaciones, identidad, coerciones WebIDL, listas vivas, fragmentos, templates, shadow roots y Window.close. Rust agrega cuatro tests sobre filtros, orden, mutaciones y liberación con resultados numéricos retenidos.

La revisión estática aislada de Codex terminó sin hallazgos accionables sobre el código. Se corrigieron y volvieron a probar el fixture de GC afectado por el cierre de body, la validación del worker que esperaba un anchor del fixture anterior y su metadata de entrada. Sus logs fallidos quedan conservados. El CLI real pasó después de los fixes; los tiempos de esos smoke tests quedan excluidos del benchmark final.

Un checkout limpio también expuso ENOENT al escribir el reporte del test de memoria de abort runners. El writer ahora crea su directorio; el flujo real aprobó cinco tests por Node partiendo de la carpeta ausente y la validación completa volvió a pasar. No se cambiaron las aserciones de GC ni se usaron mocks.

Ocho reportes de rendimiento conservan 32 workers y 36 muestras por fila/motor/etapa/runtime. Las consultas por nombre varían -93.11% a +4.78% frente al baseline; el total, incluidos tres controles compartidos, varía -93.11% a +8.05%. Todas las filas y regresiones quedan publicadas.

Las entradas de nombres preparan 100/1.000 Element y consumen cien operaciones públicas. inputBytes registra los 21 bytes del documento inicial, no el volumen del DOM preparado. Preparación, validación, cierre y GC quedan fuera del temporizador. Se alternan órdenes y motores; no se afirma velocidad universal ni mejora de suites completas.

Fuente canónica: `bacff4caae10b43c593997c4f12b48ab3c9a292707d174f8680b25b44ba63998`.
Addon validado: `ca4c8081fe104e56131ed8e4beddc39dcbef1074e26b31ec70968f2f3aadcc30`.
Paquete instalado: `22e411fab2bb08c282954339d643070d9a909a42c5343770b9a9ac5cb6ad927e`.

- [Inventario, comandos, fallos históricos y checksums](name-queries/evidence.json).
- [Benchmarks completos](../benchmarks/name-queries/README.md).
- [Memoria, ownership y límites](../memory/name-queries/README.md).

Los datos grandes usan gzip sin pérdida; el inventario verifica bytes originales y publicados. Continúan pendientes factories, algoritmos DOM y APIs delegadas a JavaScript/jsdom.
