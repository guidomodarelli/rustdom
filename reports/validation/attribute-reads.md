# Lecturas y presencia de atributos en Rust

El hito combina selección y proyección de valores de Element.getAttribute/getAttributeNS en una llamada nativa. hasAttribute/hasAttributeNS resuelven presencia sin mapear un Attr a su wrapper. Los helpers attributes.getAttributeValue/getAttributeValueNS resuelven en Rust el vacío por ausencia. El getter público title y otros wrappers de reflexión siguen aplicando sus propios contratos en el host; el runtime continúa híbrido.

La base es main baa87fa3eb1a62ec6477013bb305b2a79a0c3bb6, checkpoint-064-id-lookups, PR 76 integrado con revisión limpia del SHA publicado y ocho checks aprobados. Los cuatro fallos originales de DOMParser están resueltos desde checkpoint 58. Ver [prueba de integración de la base](attribute-reads/foundation/pr76-merged.json).

## Diseño y compatibilidad

- [attribute_reads.rs](../../src/dom/attribute_reads.rs) reutiliza el mismo índice canónico de nombres y el recorrido físico por namespace. Conserva aliases históricos, incluso cuando el Attr cambió de owner y ya no pertenece a la lista física del Element original.
- El módulo compartido attribute_operations devuelve IDs nativos internos sin volver a validar un handle ya resuelto. Los métodos raw anteriores conservan su contrato; las nuevas operaciones públicas normalizan namespace vacío a null y mantienen localName exacto y folding ASCII solo donde corresponde.
- La proyección toma prestado DomString y reutiliza el conversor a V8. Se conserva la diferencia entre ausencia y valor vacío, NUL, strings largos y surrogates aislados. No se agregó un cache ni ownership persistente.
- WebIDL, factories, efectos generales y métodos observables permanecen en su punto original. El lifecycle sigue invocando getAttributeNS; se mantienen las regresiones de FormData, ID aliases, excepciones y mutaciones durante ese getter.

## Validación ejecutada

305 tests Rust, rustfmt y Clippy en 1.98.1/1.99.1. En Node 22.12.0 y 24.14.1 pasan 3638 contratos Node, Jest 21, Vitest 32 y VM 32; 273 focales y 105 de harness por versión. Los veinte diferenciales públicos nuevos y diecisiete contratos previos también pasaron antes del cambio, contra checkpoint 64. Se agregan seis tests Rust y tres contratos raw/activación/ownership del addon real, sin mocks.

El corpus HTML5 pasó 1.784/1.784 casos comparables por Node. WPT ejecutó en un comando por versión los 240 fixtures: 83007 resultados y 1203 fallos de estándar compartidos, con paridad. Mantiene manifest, bytes, exclusiones y Range-deleteContents bloqueado, con complete=false. La paridad no certifica conformidad completa.

Pasaron 32 escenarios nuevos de GC por Node, cinco modos de memoria general, Memcheck sobre 305 tests y cuarenta controles npm/pnpm sobre el mismo paquete instalado. Node 22 usa npm 11.19.0. Se conservaron los errores iniciales del fixture (hook público en vez del impl y codificación JSON del surrogate) y la ausencia inicial del directorio de reportes en el runtime aislado; no fueron fallos de la implementación ni se ocultaron.

La revisión Codex estática del snapshot productivo terminó sin hallazgos accionables. El PR debe completar su revisión del SHA publicado y CI antes del merge. La [evidencia](attribute-reads/evidence.json) identifica 252 archivos preservados, fuentes, addon y paquete; todos los originales comprimidos conservan sus hashes.

## Rendimiento y alcance

Los [benchmarks balanceados](../benchmarks/attribute-reads/README.md) guardan ocho reportes y 60 comparaciones, once tareas de atributos y cuatro tareas adicionales de Document/controles. Las 44 filas de atributos varían -71.15% a +14.95% frente al checkpoint 64, con 9 regresiones. Se publican ambos órdenes y todo el ruido observado, sin extrapolar a suites completas. El [piloto UTF-16 inline descartado](../benchmarks/utf16-input-pilot/README.md) conserva evidencia separada; su código no se adoptó.

Queda optimizar attribute-get-miss (+14,95%/+8,96% en Node 22 a 100/1.000 Attrs; +6,88% en Node 24 a 1.000). Los hits NS permanecen en 0,16–0,82× frente a jsdom y las lecturas de valores largos también conservan costos de puente/copia. Las mejoras frente al checkpoint 64 no cierran el objetivo de rendimiento.

El [análisis de memoria](../memory/attribute-reads/README.md) separa Document/Window, referencias retenidas y memoria del proceso. Las pruebas finitas no acreditan ausencia absoluta de fugas. Quedan factories, WebIDL, algoritmos generales de Node/Document/Element y otras APIs. El índice de planificación sigue en 45,8% por áreas y no mide compatibilidad completa.

- Source SHA-256: 95f29734f5db25f0815cbd0caed602d1ccb0b7b9e6153dec994cd46cb8489fbe.
- Addon SHA-256: 10ebf630ccc70bf2ac94fec4c4a2e8ba2aaacb90070c4f229dabcde164a96803.
- Paquete SHA-256: 4f6dd54f022fd00ef1e91bf976bd858a268bc34ffd5af6056ebbeacf972ca7ab.
