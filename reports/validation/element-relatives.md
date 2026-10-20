# Hijos y hermanos Element en Rust

El hito migra el recorrido físico y filtrado de children, firstElementChild, lastElementChild, nextElementSibling y previousElementSibling a Rust. Reutiliza enlaces y node_kind canónicos; no entra en descendientes, hosts shadow ni template.content. El puente devuelve las identidades originales.

WebIDL, factories, la lista viva y su invalidación conservan la integración actual. childElementCount sigue leyendo children: las mutaciones pueden refrescar su caché antes de la siguiente lectura. El runtime continúa siendo híbrido y el objetivo integral sigue abierto.

Base medida: PR 72 corregido (`2ae5f2c`), cuyos 567 archivos de dist se cotejaron antes de medir. foundation/ conserva su integración en main y checkpoint 60. La rama de este hito es feature/native-element-relatives; verificar el PR remoto antes de asumir integración.

| Validación | Resultado |
|---|---|
| Rust 1.98.1 / 1.99.1 | Clippy y 281 tests por versión |
| Node 22.12.0 / 24.14.1 | 3.358 contratos, Jest 21, Vitest 32 y VM 32 por versión |
| Focales integrados | 613 por Node; incluyen 55 de Element y regresiones previas de colecciones |
| Harness de benchmarks | 64 por Node, 12 nuevos sobre motores reales |
| GC focal | 44 escenarios por Node |
| Paquete instalado | 20 controles por Node con npm/pnpm, mismo archivo |
| HTML5 | 1.784 comparables por Node; exclusiones conservadas |
| WPT v24.14.1 | 221 fixtures y 82939 resultados en paridad; 1200 fallos de estándar compartidos |
| WPT v22.12.0 | 221 fixtures y 82939 resultados en paridad; 1200 fallos de estándar compartidos |

WPT mantiene complete:false, exclusiones y el bootstrap bloqueado de Range-deleteContents; la paridad no certifica todos los estándares.

Las comparaciones diferenciales cubren HTML/quirks/XML, default/VM, Text/Comment/PI/CDATA, namespaces, Document/fragmentos, identidades, adopción, mutaciones, templates y scopes shadow. Las seis regresiones de Array.from fallaban antes de sustituir el mapeo del puente por un bucle de identidades; el recorrido y filtrado permanecen en Rust.

El reviewer Codex aislado terminó sin hallazgos accionables sobre el diff actualizado. Fue una revisión estática; las ejecuciones corresponden a los gates registrados. Los fallos históricos de nombre interno y expectativa del contador se conservan sin debilitar los contratos diferenciales.

Ocho reportes de rendimiento conservan 32 workers y 36 muestras por fila/motor/etapa/runtime. La variación frente al baseline es -76.72% a +8.17%; se conservan todas las filas y regresiones.
Las entradas mezclan 100/1.000 nodos físicos y consumen cien operaciones públicas. Preparación, validación, cierre y GC quedan fuera del temporizador. No se afirma velocidad universal ni un resultado sobre suites completas.

Fuente canónica: `857dbc564eb2c810ad7d87e494e0b3497c98ea4fc46c3b467dbec5d1aed618c7`.
Addon validado: `f5ae22cf5fe22d95e3a51b23693738de8c9040bc1332640d9b3ecb136899fa77`.
Paquete instalado: `3b77e9d0b06c1b9662d9cc6d4e7f229c97fa535f1cf4cd078de41171afd1aa49`.

- [Inventario, comandos, fallos históricos y checksums](element-relatives/evidence.json).
- [Benchmarks completos](../benchmarks/element-relatives/README.md).
- [Memoria, ownership y límites](../memory/element-relatives/README.md).

Los datos grandes usan gzip sin pérdida; el inventario verifica bytes originales y publicados. Continúan pendientes factories, algoritmos DOM y APIs delegadas a JavaScript/jsdom.
