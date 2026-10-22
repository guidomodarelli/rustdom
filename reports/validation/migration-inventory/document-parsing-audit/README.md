# Validación de XML y construcción de documentos

La auditoría agrega cuatro módulos, ocho anclas y cinco APIs de jsdom 27.4.0.
El catálogo tiene once módulos auditados (ocho híbridos/tres pendientes),
veinticinco anclas (dos Rust/cinco híbridas/dieciocho pendientes) y seis APIs
auditadas, todas híbridas. No cambia el denominador 531/4.374/7.246. Se acredita
solamente `DOMImplementation.hasFeature` como nuevo cuerpo Rust auditado;
no se implementó código nuevo del producto ni se completaron módulos.

El conjunto inicial pasó 434/434 tests en cada Node 22.12.0/24.14.1. Incluye
HTML, XML, MIME, doctype, realms, reentrancia, excepciones, contextos retirados,
efectos de factories y memoria de recuperación XML. Usa jsdom independiente y
el producto real A0 con un enlace `dist` al paquete oficial autenticado. Los
tests no se modificaron para apuntar a otro runtime ni se agregaron mocks.

La revisión detectó sobrecrédito en cinco anclas: helpers específicos JavaScript
todavía fijan opciones semánticas y errores de sus cuerpos originales. Se
corrigieron a híbridas, conservando la propuesta inicial y sus logs en el tar.
La corrección cambia cinco archivos en total: clasificación, documentación y
el test del ledger. `reuse-verification.json` y los manifests permiten verificar
que el producto y los otros tests son iguales.

Después de corregir se ejecutaron los once tests del inventario, el CLI y la
preparación antes/después en ambos Node: todos pasan. Se reutilizan los 423
tests de comportamiento anteriores por Node, con sus fuentes y el mismo paquete
verificados. **No se afirma haber reejecutado 434 tests en el snapshot final.**
La revisión del fix cerró el P2 sin otros hallazgos.

`evidence.tar.gz` contiene ambas instantáneas, con 230 fuentes por instantánea,
todos los comandos/logs, catálogos, reportes de compatibilidad y trazas de memoria.
El recibo fija tamaño y hash. Son 17 clasificaciones cambiadas respecto del
catálogo previo. La referencia, sus anclas y surface Node22 no cambian. Entre
Node coinciden APIs, constructores, aliases y declaraciones heredadas; difieren
profile/exclusions. No se confunde esa diferencia con cambios del denominador.

La inspección conserva los cuatro módulos originales/construidos y sus diffs,
además de los hashes de las fuentes Rust/adapters que coinciden con A0 y C.
Las ocho verificaciones completas de preparación (cuatro iniciales y cuatro
finales) devuelven la misma identidad oficial 39720077911/12400802735. No hubo
rebuild ni modificación del ensayo de ownership. Los tests amplios Rust,
Jest/Vitest y corpus completos no se reejecutaron por esta auditoría; los
contratos específicos no los sustituyen ni acreditan conformidad universal.
