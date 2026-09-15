# Corpus WPT fijado

Fuente: web-platform-tests, commit `8d124dbe46f46f55531f28f13eccf1113f794c12`, utilizado por jsdom 27.4.0 (`098d16d6b86c5f215d48658c3005cb54b1325603`). Los archivos de tests y helpers se conservan sin modificar; `manifest.json` enumera los casos y los SHA-256 de los blobs originales. La licencia BSD está incluida.

`npm run test:wpt` ejecuta las suites incluidas. También acepta `character-data`, `attributes` o `node-comparison` para una ejecución focal. Usa el harness real de WPT, recursos locales y un reporter mínimo que transfiere resultados al proceso. Los documentos XML/XHTML y sus iframes reciben el tipo de contenido correspondiente. Compara resultados, nombres y mensajes de fallo contra un jsdom independiente. Una coincidencia en fallos conocidos se registra como paridad, no como conformidad con el estándar; un harness incompleto o sin tests hace fallar la ejecución.

Este subconjunto no equivale a todos los WPT ni prueba el 100% de compatibilidad. El manifiesto permite ampliar la cobertura sin cambiar los tests upstream. Para recuperar cualquier archivo, usar su blob en la revisión fijada; `.gitattributes` evita conversiones de saltos de línea que alterarían los hashes.

La suite `dom-string-map` incorpora los siete fixtures dataset de
`html/dom/elements/global-attributes`. El archivo `.window.js` conserva sus bytes
y se ejecuta con el wrapper HTML que ya provee el arnés; las assertions no cambian.
Se reproduce con `npm run test:wpt -- dom-string-map`.

La suite `dom-token-list` incluye `dom/nodes/Element-classlist.html` y los cinco
fixtures DOMTokenList de `dom/lists`. Conserva los archivos originales y compara
los resultados de classList, atributos, índices, iteración, value y stringificación.
Puede ejecutarse con `npm run test:wpt -- dom-token-list`.

La suite `xml-serialization` incorpora `domparsing/XMLSerializer-serializeToString.html`
y `domparsing/xml-serialization.xhtml`, conservando sus bytes originales y recursos.
Se ejecuta con `npm run test:wpt -- xml-serialization`. Sus resultados incluyen los
fallos de estándar compartidos con la referencia; no se modifican las assertions.

La suite `tree-traversal` agrega los 16 fixtures HTML de `dom/traversal` y sus
recursos de la misma revisión. Cubre constantes NodeFilter, NodeIterator,
reparación ante remociones, movimientos TreeWalker, filtros y realms. Puede
ejecutarse con `npm run test:wpt -- tree-traversal`. Los borradores XML de
`dom/traversal/unfinished` no forman parte de esta suite. Los 26 fallos compartidos
observados se preservan en los resultados, sin reemplazar assertions upstream.

La suite `namespaces` incluye las consultas de prefijo, URI y namespace por defecto,
con los fixtures originales HTML y XHTML. Se aplica la misma comparación de
estados y mensajes, conservando también los fallos compartidos con jsdom.

La suite `node-text` incluye lecturas/escrituras de `nodeValue` y `textContent`,
además de registros de MutationObserver producidos por las escrituras. El cambio
nativo de getters se verifica también contra esos setters y sus efectos reales.

La suite `normalization` agrega el fixture original de Node.normalize, incluidos
fragmentos, textos vacíos y la exclusión de CDATA, comentarios y otros nodos.

La suite `boundary-points` incorpora comparaciones, puntos e intersecciones de
Range, incluidos binding y shadow DOM. Los casos comparten `dom/common.js` de
la misma revisión; los errores de preparación de rangos también quedan en el
reporte y no se presentan como aserciones de estándares aprobadas.

La suite `dom-rect` agrega DOMRect-001, DOMRect-002 y DOMRect-nan de la misma
revisión upstream, sin modificar sus aserciones. Cubre DOMRect y DOMRectReadOnly,
constructores, atributos y valores especiales; no certifica las otras interfaces
geométricas ni layout.

Las suites `web-storage` y `web-storage-events` conservan 40 fixtures originales
de Storage, propiedades, eventos entre iframes y cuotas, más sus recursos locales.
No incluyen aquí escenarios de particionamiento, window.open o document.domain;
no se interpreta este subconjunto como conformidad completa de almacenamiento.

La suite `blob-file` conserva siete fixtures de constructores, finales de línea
y slice, más el helper original `FileAPI/support/Blob.js`. Los archivos `.any.js`
se ejecutan aquí únicamente en Window y sus scripts META se cargan antes de la
fixture. No se acredita cobertura Worker. Los fallos compartidos por métodos
modernos ausentes en jsdom (text/arrayBuffer) se registran como límites, no como
lecturas de contenido aprobadas.

El comparador canoniza solo la fecha de la descripción del input `new Date()`
en el fallo de argumentos no iterables de `Blob-constructor.any.js`: dos
ejecuciones pueden cruzar un segundo. Los estados y diagnósticos de excepciones
siguen comparándose y todos los mensajes crudos se guardan sin cambios.

La suite `file-reader` incorpora 13 fixtures originales de estados, resultados,
abortos, eventos y detección de encoding. Los `.any.js` se ejecutan solo en
Window; no se cuentan aquí los escenarios Worker ni los archivos manuales.
