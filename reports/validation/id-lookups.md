# Índice de IDs de Document y búsquedas SVG en Rust

La rama feature/native-id-lookups parte de main `60f7cb6`, checkpoint 63,
integrado por el PR 75. El baseline medido es su head revisado `859c111`,
con árbol idéntico al squash. Se migra el índice de Document.getElementById
y el recorrido de SVGSVGElement.getElementById. El runtime conserva WebIDL,
factories, la selección de hooks de atributos y los efectos generales del
host: este hito no termina la reescritura integral.

Document conserva el orden de registro de candidatos de jsdom, incluidos
duplicados y escrituras del mismo valor; puede diferir del orden físico tras
cambiar un ID. El índice Rust usa keys Arc de UTF-16 y solo IDs numéricos
de nodos. La selección comprueba la raíz física actual sin reinterpretar el
atributo, para preservar aliases creados por un id extranjero sin prefijo.
Los índices reversos eliminan aliases cuando se libera Element o Document.
La primera suite general detectó 86 diferencias de trazas de FormData al
eliminar lecturas internas de ID. Se restauró la invocación original y se
agregaron dieciséis regresiones diferenciales de orden, aliases, excepciones
y mutación durante getAttributeNS. Se conserva la ejecución fallida original.

SVG busca en orden físico e incluye el propio root. Acepta un atributo ID
vacío explícito; la ausencia de atributo no coincide. Reutiliza el recorrido
prestado de fragmentos con su alcance y reglas propias. Los hooks de alta y
baja conservan la lectura observable getAttributeNS y pasan su valor a Rust;
el cambio de valor realiza
una transacción nativa para conservar orden y reutilizar capacidad.

- Rust 1.98.1 y 1.99.1: Clippy y 299 tests por versión.
- Node 22.12.0 y 24.14.1: 3615 contratos, Jest 21, Vitest 32 y VM 32 por versión.
- 106 diferenciales contra jsdom 27.4.0 en el baseline; 109 focales finales y 994 integrados por Node.
- 94 contratos de harness por Node y CLI real de nueve workloads, cuatro workers y dieciocho filas por reporte.
- HTML5: 1.784 casos comparables por Node. WPT conserva intacto el manifest y corpus del checkpoint 63.
- WPT v24.14.1: un comando completo, 240 fixtures, 83007 resultados, 1203 fallos de estándar compartidos; paridad true, complete=false.
- WPT v22.12.0: un comando completo, 240 fixtures, 83007 resultados, 1203 fallos de estándar compartidos; paridad true, complete=false.
- Memcheck: 299 tests Rust en 10 lotes; control histórico de 291 tests y stacks completos conservados.
- El mismo paquete pasó veinte controles npm/pnpm en cada Node: cuarenta en total.

Los contratos cubren HTML/XML, UTF-16, namespaces y aliases, duplicados,
movimientos/adopción, templates/shadow, DOMParser, apertura/escritura/cierre,
errores WebIDL y reacciones de custom elements. El harness inicial capturaba
solo open en dos casos XML: la referencia permite open pero rechaza write
después de remover hijos. Se conservan ese fallo del fixture, su corrección
y los baselines ampliados; se verifican errores y efectos parciales.

Las exclusiones y el bootstrap bloqueado de Range-deleteContents siguen
declarados. La igualdad con jsdom, incluidos fallos compartidos de estándar,
no certifica conformidad completa ni compatibilidad total fuera del corpus.

Fuentes medidas: `95f641ef6dd84ddac7bbd70119121ece19669c125d5bb3c70d9693c9770a19b1`. Addon: `cc8852f6ba6e3755fbe8805948c8fb71bd140323b08b86d091727aacc8ed6753`.
Paquete instalado: `0df0630b39e3367913dd766fcd61bbe15f79d85d76e21d470ce596c8200c79ee`.

- [Inventario, logs y checksums](id-lookups/evidence.json).
- [Benchmarks con todas las regresiones](../benchmarks/id-lookups/README.md).
- [Ownership, GC y Memcheck](../memory/id-lookups/README.md).

La revisión local aislada del código y harness no encontró hallazgos
accionables. El diff final, CI y revisión del SHA del PR se verifican antes
de integrar. El objetivo integral continúa abierto.
