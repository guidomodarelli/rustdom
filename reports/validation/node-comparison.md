# Comparaciones nativas de Node

## Alcance de la implementación

`Node.isEqualNode`, `Node.contains` y `Node.compareDocumentPosition` llaman a Rust
desde los wrappers reales. El build elimina los algoritmos de comparación de la
copia privada de jsdom, manteniendo el paquete independiente como oráculo.
Los identificadores de DocumentType y el target de ProcessingInstruction se
almacenan en Rust; las actualizaciones de CharacterData preservan el target.

Esto no completa Node, Document, Element ni la migración integral. La creación de
objetos, otras mutaciones, eventos y las familias pendientes permanecen en la
hoja de ruta.

## Decisiones de diseño

- La igualdad usa una pila explícita de pares de IDs. No recurre por cada nivel
  del árbol y conserva el orden de los hijos en las comparaciones.
- Los atributos se comparan por namespace, nombre local y valor, sin depender de
  su orden o prefijo. El conjunto hash usa claves prestadas sobre los datos
  nativos y una función hash aleatoria; no copia los valores de los atributos.
- La contención recorre los padres. La posición documental considera además las
  relaciones de Attr de jsdom 27. No trata el host de un shadow root como padre.
- Los IDs público y de sistema de doctype se guardan en una estructura opcional
  con asignación propia. Los demás nodos no reservan ambos buffers de texto.
- Los metadatos nativos y el transporte Node-API preservan UTF-16, incluidos
  surrogates aislados.

## Compatibilidad comprobada

La validación inicial completa de esta fase pasó con Node 24.14.1 y Rust 1.98.1:
28 tests Rust, 123 contratos JavaScript, 7 tests Jest, 11 tests Vitest, 4 tests de
sus pools VM y 1.784 casos del corpus HTML5. Los ocho casos script-on excluidos
siguen identificados por el runner del corpus.

Se agregaron WPT originales de comparación y contención, con helpers, recursos
XML y hashes de los blobs de la revisión fijada. El cargador local conserva el
tipo de contenido de los documentos XML/XHTML y de sus iframes.

| WPT añadido | Casos aprobados |
| --- | ---: |
| Node-compareDocumentPosition.html | 1.444 |
| Node-contains.html | 1.482 |
| Node-contains-xml.xml | 8 |
| Node-isEqualNode.html | 9 |
| Node-isEqualNode-xhtml.xhtml | 14 |

El total versionado llega a 3.347 casos con paridad, de los cuales 3.345 cumplen
las expectativas WPT. Los dos fallos compartidos preexistentes de adopción de
atributos no se cuentan como conformidad con el estándar. La evidencia está en
[`2026-09-12T01-04-35.944Z-linux-wpt.json`](../compatibility/2026-09-12T01-04-35.944Z-linux-wpt.json).

El [paquete instalado fuera del checkout](../distribution/2026-09-12T01-15-40.043Z-linux-x64.json)
pasó sus 16 controles con npm y pnpm. Los consumidores TypeScript/CommonJS/ESM
ejercen los nuevos metadatos y comparaciones, incluido el entorno VM de Vitest.

Los contratos adicionales ejercen todos los pares de múltiples tipos de nodos,
árboles desconectados, cambios de parentesco y texto, atributos movidos, aliases,
templates, shadow roots, doctypes y targets después de mutaciones. Se preservan
comportamientos observables del oráculo fijado: por ejemplo, la comparación de
un Attr consigo mismo cuando está adjunto devuelve 34, y la igualdad de CDATA
no considera su texto en jsdom 27.

## Revisión de memoria y recursos

La revisión del cambio abarca el almacenamiento, los nuevos métodos Node-API,
el puente de wrappers, las pruebas y el estrés. No se agregan referencias
persistentes N-API, listeners, timers ni caches de nodos para comparar.
Las pilas, vectores y conjuntos de las operaciones se destruyen al retornar,
también ante errores. Las claves prestadas no sobreviven a la llamada Rust.

Los tests Rust comparan dos árboles de 2.000 niveles, liberan sus 4.002 nodos y
verifican que el almacenamiento vivo y los datos vuelven a cero. El estrés
de proceso agrega 500 comparaciones contra un árbol vivo por motor y observa
1.500 referencias débiles a clones, doctypes e instrucciones, además de los
escenarios anteriores de ventanas, atributos y entornos. Su ejecución completa
y los benchmarks se guardan por separado en sus carpetas de resultados.

El [estrés ejecutado](../memory/2026-09-12T01-08-45.113Z-linux-x64.json) pasó en
jsdom, rustdom, parser nativo y ambos entornos Vitest. Rustdom liberó los 1.500
nodos comparados observados y los 880 documentos y 880 ventanas de los otros
escenarios; sus contadores de nodos y datos nativos volvieron a cero. El
crecimiento de heap tras GC fue 0,84 MiB y el de RSS 4,23 MiB en esta ejecución.

[Valgrind/Memcheck 3.18.1](../memory/2026-09-12T01-20-10.091Z-valgrind.json)
ejecutó los 28 tests Rust reales en 285,81 segundos: cero errores de acceso,
cero bytes definitivamente perdidos y cero indirectamente perdidos. El
[log íntegro](../memory/2026-09-12T01-20-10.091Z-valgrind-0.log) conserva 48 bytes
posiblemente perdidos en `std::thread`/el runner de tests y 544 bytes alcanzables
en el manejo de stack del runtime Rust. No hay supresiones. Este chequeo cubre
el ejecutable Rust; el addon cargado y V8 se ejercen mediante el estrés de proceso.

No se interpreta esta revisión ni una prueba finita como demostración absoluta
de ausencia de fugas. Las estructuras temporales crecen con el tamaño de los
árboles y atributos de la operación; no son caches persistentes.
