# Corpus WPT fijado

Fuente: web-platform-tests, commit `8d124dbe46f46f55531f28f13eccf1113f794c12`, utilizado por jsdom 27.4.0 (`098d16d6b86c5f215d48658c3005cb54b1325603`). Los archivos de tests y helpers se conservan sin modificar; `manifest.json` enumera los casos y los SHA-256 de los blobs originales. La licencia BSD está incluida.

`npm run test:wpt` ejecuta las suites incluidas. También acepta `character-data`, `attributes` o `node-comparison` para una ejecución focal. Usa el harness real de WPT, recursos locales y un reporter mínimo que transfiere resultados al proceso. Los documentos XML/XHTML y sus iframes reciben el tipo de contenido correspondiente. Compara resultados, nombres y mensajes de fallo contra un jsdom independiente. Una coincidencia en fallos conocidos se registra como paridad, no como conformidad con el estándar; un harness incompleto o sin tests hace fallar la ejecución.

Este subconjunto no equivale a todos los WPT ni prueba el 100% de compatibilidad. El manifiesto permite ampliar la cobertura sin cambiar los tests upstream. Para recuperar cualquier archivo, usar su blob en la revisión fijada; `.gitattributes` evita conversiones de saltos de línea que alterarían los hashes.

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
