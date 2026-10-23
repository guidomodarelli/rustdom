# DOMStringMap: correspondencia estática y propuesta de clasificación

Esta auditoría documenta implementación existente. No agrega Rust ni modifica el
ledger. La propuesta contiene doce filas: dos módulos, nueve anclas y una API.
Seis anclas ejecutan sus decisiones en Rust y tres siguen híbridas; el
constructor público permanece pendiente. El constructor interno y toStringTag
se difieren explícitamente. Los totales vigentes siguen siendo 18 módulos,
32 APIs y 55 anclas auditadas sobre 531/4374/7246; scopeClosed=false y
migrationPercent=null. No sumar dimensiones ni confundir anclas con esfuerzo.

## Frontera de implementación

| Referencia | Correspondencia actual y límite |
| --- | --- |
| attrCamelCase y su callback | property_name conserva la selección ASCII y conversión por unidades UTF16 en Rust. Dos anclas del catálogo corresponden al mismo algoritmo, no a dos algoritmos normativos adicionales. |
| attrSnakeCase y su callback | attribute_name transforma mayúsculas ASCII en guion/minúscula y conserva las otras unidades UTF16. También son dos anclas, no dos algoritmos independientes. |
| supportedPropertyNames | TreeStore::dataset_names recorre Attr canónicos, filtra por localName y deduplica en orden; el host transporta strings y el handle del Element. |
| namedGet | TreeStore::dataset_value encuentra la primera coincidencia de localName, sin filtrar namespace. Option se transporta como undefined en el binding; no completa el Proxy. |
| namedSetNew | El plan de nombres y validación es Rust; JavaScript selecciona y compone las excepciones y ejecuta setAttributeValue con sus efectos. Sigue híbrido. |
| namedSetExisting | Conserva la delegación JavaScript a namedSetNew y sus decisiones híbridas. No se acredita Rust completo por la llamada indirecta. |
| namedDelete | Rust transforma el nombre sin validación de setter; JavaScript ejecuta removeAttributeByName por nombre calificado. Sigue híbrido. |
| generated/DOMStringMap.js | El Proxy, branding, conversión WebIDL, visibilidad, descriptores y reacciones siguen en JavaScript. El módulo permanece pendiente. |

El módulo impl completo es híbrido. El constructor interno solo conserva el
global y el Element en el host; falta su auditoría conjunta con factories y
consumidores antes de acreditar esa fila. Mantener aristas visibles a V8 no
exige por sí mismo migrar infraestructura mecánica a Rust.

La escritura usa namespace nulo; la lectura y enumeración recorren localName
incluyendo atributos con namespace; el borrado se resuelve por nombre
calificado y no valida como el setter. Esa asimetría es observable y debe
preservarse. Los helpers de atributos y el validador XML son dependencias
separadas: usar sus rutas nativas no completa sus módulos enteros.

## Alcance público que sigue abierto

El catálogo solo declara DOMStringMap como constructor y su toStringTag. Las
operaciones dinámicas de propiedades del Proxy no tienen entradas individuales
en ese perfil. Se registra la brecha, sin inventar IDs ni cerrar el denominador.
Los getters HTMLElement.dataset y SVGElement.dataset existen en el catálogo y
se enumeran como consumidores fuera de esta propuesta; aquí no se clasifican.
No se afirma que una API pública de dataset esté completamente migrada.

## Fuentes y validación pendiente

Ocho fuentes locales coinciden byte por byte con la preparación oficial
39720077911/artifact12400802735, cuyo index conserva SHA cb30a9c1. Cinco archivos
construidos del paquete B coinciden con su manifest y cinco fuentes del jsdom
27.4.0 independiente coinciden con el catálogo. El shim construido usa
string-map.cjs, mientras Proxy y driver de atributos permanecen JavaScript.
El paquete estático conserva 31 miembros, fuentes completas, productor,
index oficial, propuesta y antecedentes; todos se verificaron por readback.

No se ejecutaron DOM, addon, generador, suites, GC o benchmarks. El verificador
solo comprueba IDs reales, alcance propuesto/diferido y bytes del archivo.
Antes de integrar al ledger deben pasar catálogo y comportamiento relevante
en Node 22.12.0 y 24.14.1 después del estudio ownership original aún activo.

Los antecedentes focales registran 81 tests públicos, cuatro nativos y tres
Rust. El WPT histórico registra 44 aprobados y un fallo compartido, no una
certificación completa. Esos logs corresponden a su build histórico; no son
una ejecución de esta auditoría ni aprobación del runtime actual completo.
La medición histórica de escritura y borrado fue desfavorable, especialmente
borrado de 1000 atributos (~22,5 veces jsdom). Se conserva ese límite, sin
reclasificarlo como mejora o aceptación del gate ownership.

## Ownership y memoria

Los algoritmos Rust usan buffers temporales y el forest existente: no conservan
Element, Window, callbacks N-API o un registro permanente de dataset. Los
contadores AtomicU64 son telemetría, no colecciones de referencias. El bridge
conserva Element y global visibles a V8; retener el mapa puede retener sus
owners. Arrays de claves/valores contienen strings independientes y no deberían
retener el árbol después de soltar el mapa.

El helper histórico retiene y suelta mapas durante seis ciclos de 1000 atributos
y observa mapa, elemento, Document y Window por separado. Se preservan sus
resultados y el Memcheck histórico: sin pérdidas definitivas o indirectas,
con 48 bytes posiblemente perdidos y 544 alcanzables de std/libtest. No se
ejecutaron otra vez ni se descartan esos residuos. Son controles finitos, no
prueba de ausencia universal de fugas o de memoria pico. Ownership N-API
también depende del hito PR80 abierto.
