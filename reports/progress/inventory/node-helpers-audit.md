# Auditoría del helper `living/node.js`

Clasificación: **híbrido**, sobre `main` / checkpoint 67,
`3d37f89976a48203e80cc5c435e099267f4ce346`. Referencia independiente:
jsdom 27.4.0, digest de fuentes
`6195104b9e153430a280485e51cbbbd738c73b9b1c7bc422a5df3d13a591fc5f`.
El módulo tiene siete exportaciones originales. Se inspeccionaron la referencia,
las sustituciones de `scripts/build.mjs`, los adaptadores y el runtime construido.

| Exportación de referencia | Ruta actual y trabajo pendiente |
| --- | --- |
| `clone` | Conserva el switch por tipo de nodo, selección de factory, copia de atributos, invocación de `cloningSteps` y recorrido recursivo en el módulo privado JavaScript. Los datos y enlaces subyacentes usan Rust. |
| `listOfElementsWithClassNames` | Se sustituye por `src/dom/collection-queries.cjs`: selección de clases y recorrido en `src/dom/collection_queries.rs`; factory, actualización de la colección y resolución de wrappers siguen en JavaScript. |
| `listOfElementsWithQualifiedName` | Mismo adaptador; matching de nombres, modo HTML, namespaces y orden se deciden en Rust. Conserva las responsabilidades de colección del host. |
| `listOfElementsWithNamespaceAndLocalName` | Mismo adaptador; normalización y comodines se resuelven en el filtro Rust. Conserva las responsabilidades de colección del host. |
| `convertNodesIntoNode` | Conserva las ramas uno/muchos, `typeof`, creación de Text/DocumentFragment y el bucle de append en JavaScript. No es solo un binding. |
| `locateNamespacePrefix` | El helper recursivo se elimina del módulo construido. Los consumidores públicos llegan a los algoritmos de `src/dom/namespaces.rs` a través de `native-tree.cjs` y `tree.rs`. |
| `locateNamespace` | Se elimina junto con el anterior; búsqueda, declaraciones, owners y ascendencia se deciden en la ruta nativa de namespaces. |

La clasificación agrega un módulo auditado, de tres a cuatro. No altera las
531 fuentes, 4.331 entradas de API ni 7.246 anclas. No acredita nuevas anclas,
APIs terminadas ni esfuerzo restante; el porcentaje global continúa desconocido.
No modifica código de producción ni pretende medir una mejora del motor.

## Evidencia y límites

`tests/collection-queries.spec.cjs` y `tests/collection-query-fuzz.spec.cjs`
ejercen orden, invalidación, namespaces y modos HTML/XML con el addon real.
`tests/namespaces.spec.cjs` cubre los consumidores públicos de namespaces.
`tests/native-tree.spec.cjs` conserva una regresión de clonado/adopción con
enlaces nativos; `tests/node-text.spec.cjs` incluye `prepend` y mutaciones.
Estos tests pertenecen a la matriz de checkpoint 67, documentada en
`reports/validation/xml-serializer-controller.md`; no prueban por sí solos
todos los hooks, factories o combinaciones posibles de clonado/conversión.

La auditoría describe la fuente integrada, no las primitivas experimentales de
`feature/native-attribute-copy` o `feature/native-node-clone`. Sus gates y sus
resultados pendientes no se trasladan a este ledger como trabajo completado.

## Salida necesaria para migrar el módulo

Llevar a Rust el control completo de clonado y conversión, con orden observable
de lectura/factories/hooks, semántica de atributos y tipo de nodo, recursión,
excepciones y reentrancia. Ejercer sus consumidores `Node.cloneNode`,
`Document.importNode`, contenido de Range y las operaciones ParentNode/ChildNode
correspondientes en Node 22/24 y realms independientes. Comparar rendimiento
público y liberación en éxito/error con el estado previo.

La entrega debe distinguir el control propio del helper de las dependencias:
factories, adopción, mutación, elementos especiales, custom elements y wrappers.
El módulo no puede declararse completamente migrado mientras mantenga sus
decisiones en JavaScript; completar su control tampoco completa esas otras
dependencias ni el inventario global.
