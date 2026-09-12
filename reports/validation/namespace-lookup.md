# Consultas de namespaces nativas

`lookupNamespaceURI`, `lookupPrefix` e `isDefaultNamespace` recorren metadata,
atributos vivos y ancestros en Rust. Los wrappers mantienen las conversiones
WebIDL. Las declaraciones se leen prestadas desde el almacenamiento canónico;
solo el resultado vuelve por Node-API y no se incorporan caches ni referencias
a objetos JavaScript.

Se conserva la precedencia de jsdom 27.4.0 entre namespace propio, declaraciones
y ancestros, incluida la interrupción por declaraciones vacías. Document busca
su elemento raíz; Attr usa su owner actual; Text y Comment usan parentElement;
DocumentType, DocumentFragment y ShadowRoot conservan sus límites. El recorrido
es iterativo y las comparaciones preservan unidades UTF-16 aisladas.

La validación inicial pasó **49 tests Rust, 181 contratos Node, 7 tests Jest,
11 tests Vitest, 4 tests de pools VM y 1.784 casos HTML5**. El
[informe WPT](../compatibility/2026-09-12T03-48-07.432Z-linux-wpt.json)
registra **3.433 casos en paridad**, con 3.425 aserciones de estándares aprobadas.

Los dos fixtures nuevos aportan 86 casos: 75 de URI/default y 11 de prefijos.
Seis de los primeros fallan también en el jsdom independiente: expectativas
WPT sobre los prefijos incorporados `xml` y `xmlns`. Se mantienen las aserciones
upstream y se registran esos fallos compartidos; no se presentan como conformidad
completa. Los otros dos fallos compartidos preexistentes son de adopción de Attr.

Los contratos propios ejercen declaraciones cambiantes, movimientos de subárboles,
transferencia de Attr, XML, UTF-16 y errores WebIDL. Los consumidores instalados
incluyen consultas públicas y nativas, y el estrés agrega declaraciones grandes
en clones transitorios.

El [estrés con el endpoint integrado](../memory/2026-09-12T04-01-54.560Z-linux-x64.json)
pasó en ambos motores. Se recolectaron los 882 Document/Window y los 1.500 nodos
comparados, incluyendo clones con declaraciones de namespace de 8.196 unidades
UTF-16. Rust volvió a cero nodos, datos y colecciones nativas; el crecimiento
observado fue heap +0,91 MiB y RSS +9,48 MiB. Todos los endpoints alcanzaron
el estado requerido. Las consultas no agregan almacenamiento persistente;
esta prueba finita no demuestra ausencia absoluta de toda fuga.

Se conserva el [intento con archivo anterior](../distribution/2026-09-12T03-52-30.051Z-linux-x64.json),
que falló porque el consumidor nuevo pedía métodos ausentes en el paquete del
hito previo. Fue un error de secuencia de validación: se creó el archivo de
namespaces antes de repetir la instalación. No se relajaron los tipos ni las
aserciones para aceptar ese archivo antiguo.

La [instalación final de namespaces](../distribution/2026-09-12T04-01-57.676Z-linux-x64.json)
aprobó los 18 controles con npm y pnpm sobre Node 24.14.1. Ambos consumidores
ejecutaron los métodos nuevos; también pasaron tipos, CommonJS, ESM/VM, workers,
perfil Unicode desconocido, Jest y los dos entornos Vitest. El SHA-256 del archivo
es `82d2b5000100833596bdaa422fdaf2d90b49b3f3afa2aa95251098f91e0be1bf`.

El [benchmark inicial](../benchmarks/2026-09-12T04-06-51.829Z-linux-x64.md)
midió 3.000 consultas públicas sobre un Text descendiente de una tabla de 250
filas: **2,438 ms en rustdom frente a 1,209 ms en jsdom (0,50×)**. Usa cuatro
procesos aislados con orden alternado, tres warmups y nueve muestras por proceso,
verifica los 3.000 resultados y conserva todas las muestras. No hubo otras
compilaciones, tests o análisis de memoria en paralelo. La construcción y el GC
quedan fuera del tiempo medido. El resultado es una regresión y permanece como
baseline; migrar una operación a Rust no acredita por sí solo una mejora.

La integración posterior de los fixtures eficientes de Valgrind del commit
`4a7003adc9e71a725b91c4ed2b20bc6e148cad1d` pasó los **51 tests Rust** de esta
rama. El cambio de CI está limitado a `cfg(test)` y no modifica las consultas,
el binario de producción medido ni los controles de memoria del DOM.

## Transferencia de resultados sin copia intermedia UTF-8

Las consultas devuelven ahora préstamos de la metadata nativa. Para strings
UTF-8, la implementación de `ToNapiValue` de napi-rs copia directamente a V8,
sin construir un `Vec<u16>` intermedio. Las unidades UTF-16 aisladas conservan
su conversión sin pérdida. También se evita comparar la URI propia de elementos
sin prefijo y las constantes UTF-8 se comparan directamente. No se incorporan
caches, referencias JavaScript ni bloques `unsafe` propios.

Pasaron Clippy, **51 tests Rust**, los tres contratos públicos y los
[3.433 WPT en paridad](../compatibility/2026-09-12T04-15-03.655Z-linux-wpt.json).
El [nuevo benchmark](../benchmarks/2026-09-12T04-16-08.784Z-linux-x64.md) dio
**2,211 ms** frente al baseline de 2,438 ms, aproximadamente 9 % menos. jsdom
midió 1,186 ms: el ratio es **0,54×**, todavía desfavorable. No se atribuye una
aceleración general a este cambio ni se oculta el costo restante del enlace.

El [estrés posterior](../memory/2026-09-12T04-16-46.986Z-linux-x64.json) pasó
con cero supervivientes entre 882 Document/Window y 1.500 nodos comparados;
los contadores nativos volvieron a cero. Rustdom registró heap +0,91 MiB y
RSS +5,65 MiB. Esta validación ejerció el addon reconstruido con el resultado
prestado y su fallback UTF-16.
