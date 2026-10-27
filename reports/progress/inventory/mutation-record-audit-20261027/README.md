# Auditoría de MutationRecord en la fuente 4196c496

Esta entrega clasifica un módulo, diez entradas de API y tres anclas de la
referencia fijada jsdom 27.4.0. No agrega implementación Rust. Los denominadores
permanecen en 531 archivos, 4.331 APIs y 7.246 anclas, como dimensiones separadas.
La clasificación del conjunto sigue abierta; migrationPercent permanece null.

| Filas nuevas | Híbridas | Pendientes | Rust completo |
| --- | ---: | ---: | ---: |
| Módulo MutationRecord-impl | 1 | 0 | 0 |
| Nueve getters y constructor público | 9 | 1 | 0 |
| Constructor interno y dos getters de listas | 3 | 0 | 0 |

Se excluye toStringTag de esta auditoría. No se cuenta herencia ni se acreditan
los módulos generados, NodeList, MutationObserver o dependencias completas.
audits.json contiene las 14 filas; el ledger canónico conserva las 50 anteriores
y agrega estas 14. source-map.json fija las fuentes inspeccionadas y la
referencia independiente por hash. El constructor interno no crea el snapshot
Rust: recibe el payload preparado upstream y retiene realm, owners y WeakRef.

El snapshot inmutable Rust valida handles, conserva UTF-16/null, orden y
duplicados de IDs, y no posee referencias JavaScript ni el árbol. El binding
comparte el payload mediante Arc y observa la finalización de wrappers.
No se atribuye esa creación nativa al cuerpo del constructor JavaScript.

Los getters escalares leen tipo/textos nativos; el bridge normaliza null donde
corresponde. target y siblings resuelven IDs a objetos; target además conserva
SameObject público. Solo addedNodes y removedNodes proyectan listas de IDs y
construyen NodeLists estáticas mediante la factory del realm original. Los
wrappers generados conservan branding, validación de receiver y excepciones;
el constructor público ilegal arroja TypeError sin alcanzar el estado Rust.

Los owners visibles a V8 y el WeakRef tienen una función de lifetime necesaria:
eliminar esas aristas no migra algoritmos y puede romper retención o recolección.
Los consumidores NodeList y contratos WebIDL pendientes se inventarían por
separado; no quedan completos por trasladar el payload del registro.

La integración efectiva se observa en scripts/build.mjs: el runtime privado usa
src/dom/mutation-record.cjs, con factories reales de NodeList y NativeSymbolTree.
Los contratos públicos existentes cubren nulabilidad/UTF-16, los nueve campos,
listas estáticas, SameObject, adopción, realms y constructor ilegal. Sus fuentes
y evidencia histórica figuran por fila. No son certificación completa de DOM.

La validación nueva ejerce el CLI real del catálogo y sus ocho contratos, en una
vista física de la propuesta con dependencias reales; no pretende ser un checkout
Git ni modifica la fuente científica 4196. Las pruebas distinguen las nueve
APIs híbridas del constructor pendiente y rechazan IDs/afirmaciones sin sustento.
Los logs, fallos de preparación y salida completa de ambos SDK se conservan en
reports/validation/inventory-mutation-record-audit/20261027/. La lectura del
catálogo es desarrollo: no crea muestras del piloto ni acepta rendimiento Rust.

La página native-migration.md omitía una auditoría previa de DOMImplementation:
mostraba seis módulos/32 APIs frente a los siete/37 del resumen canónico. Esta
entrega corrige esa inconsistencia y registra ocho módulos, 47 APIs y nueve
anclas auditadas. Auditar más filas no demuestra mayor implementación Rust.

El hito ownership continúa pendiente de rendimiento. El piloto jsdom v2 activo
conserva su fuente, paquete, método y presupuestos; esta auditoría no lo modifica
ni reemplaza rechazos históricos. El runtime continúa híbrido y el objetivo
general está incompleto.
