# Auditoría del adaptador de parsing HTML

`lib/jsdom/browser/parser/html.js` de jsdom 27.4.0 queda **híbrido**, con la
clasificación del módulo auditada. Su referencia ocupa 7.129 bytes, SHA-256
`d3c8ae7f9330eaa6dfb6b8d9b918b1a6398a43d40d71648b99b7f3e30a0e5333`.
El archivo construido A0/C ocupa 7.351 bytes, SHA-256
`24a31550a69551f5bbfe8f57c5501fae9fe9e8b9f50c55599e5ceff890b62b9a`.
Se leyó el módulo completo, su transformación del build, el bridge y el productor
Rust de tape. Sus veinte anclas no reciben clasificación individual en esta
entrega; tampoco sus dependencias o APIs públicas se declaran completas.

## Responsabilidades actuales

| Parte | Implementación y decisiones |
| --- | --- |
| Parseo de documento o fragmento admitido | `src/lib.rs` configura html5ever, construye un RcDom temporal y codifica una tape JSON iterativa. Contexto y atributos del fragmento cruzan N-API. |
| Selección de ruta | `src/parser/bridge.cjs` decide fallbacks por opciones, registry, ancestros, contexto y UTF-16. Usa parse5 para las rutas de compatibilidad. |
| Reconstrucción desde tape | JavaScript interpreta eventos con switch y pila; crea nodos, normaliza atributos, conecta templates y ordena hooks push/pop. |
| Adaptador jsdom | JavaScript selecciona ownerDocument y factories, decide cuándo ejecutar custom element reactions, adopta atributos, combina textos y materializa nodos. Las operaciones compartidas usan el árbol nativo debajo. |
| Configuración pública | `parseIntoDocument` y `parseFragment` conservan opciones y contexto en JavaScript, y llaman al bridge. WebIDL y los consumidores son dependencias pendientes por separado. |

El build reemplaza el import de parse5 por `parser-bridge.cjs`, agrega el acceso
a `domSymbolTree` y sincroniza datos del template después de reemplazar su
contenido. La inyección de require privado es otro cambio de empaquetado. Los
archivos originales/construidos y el diff completo se conservan en la evidencia;
la correspondencia física anterior ya los identificaba como reescritos.

## Rutas que todavía delegan

El bridge conserva `source-locations`, `document-scripts`, `fragment-namespace`,
`custom-elements`, `form-context`, `legacy-select`, `unpaired-surrogate` y
`root-attribute-merge`. El productor Rust puede añadir `table-foster-parenting`
o `legacy-select` después de construir el árbol. En esos casos hubo trabajo Rust
antes de volver a parsear con parse5: un contador de fallback no demuestra que
se haya omitido Rust. El contador nativeDocument/nativeFragment cuenta tapes
reproducidas, no todos los intentos nativos ni el costo del puente.

La prueba pública del parser compara árboles, serialización, atributos y
templates con jsdom independiente, y ahora comprueba las rutas observadas de
compatibilidad. También ejerce custom elements con construcción/conexión reales
y UTF-16 mal formado en atributos del contexto. Las observaciones de una ruta
no certifican que todas las entradas del fallback estén cubiertas ni sustituyen
el corpus HTML5 y los fallos de estándares compartidos ya publicados.

## Criterio de salida y recursos

Completar el módulo exige trasladar las decisiones de selección, configuración,
reconstrucción y efectos de construcción a Rust, resolver los casos delegados y
retirar parse5 de esas rutas de producción. No basta eliminar el import del
adaptador mientras el bridge siga delegando. Deben preservarse coerciones,
errores/realms, template ownership, orden de hooks y reentrancia de scripts y
custom elements. La migración general de construcción/mutación es una dependencia.

RcDom/tape son temporales por llamada; los nodos públicos y sus wrappers viven
en el runtime híbrido. Esta auditoría no cambia ownership ni prueba por sí sola
liberación universal del árbol temporal. Las pruebas cierran sus ventanas; la
evidencia GC del generador observa Window y Document por separado y tiene otro
alcance. Los benchmarks del inventario no miden parseo HTML ni costo N-API.

El catálogo pasa de seis a siete módulos auditados: cinco híbridos y dos
pendientes. Las diecisiete anclas y una API auditadas no cambian, ni los
denominadores 531/4.374/7.246. No hay nuevo Rust completo ni porcentaje global.
