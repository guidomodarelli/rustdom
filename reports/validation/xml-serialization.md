# Serialización XML en Rust

Los algoritmos de XMLSerializer y de concatenación XML de fragmentos ejecutan en
Rust. El adapter JavaScript conserva opciones y wrappers; los callers originales
siguen creando DOMException en su realm. HTML mantiene su serializador nativo
existente. La creación de documentos y otras familias DOM siguen pendientes dentro
del objetivo integral.

El serializador es una función independiente de NativeTree. Lee propiedades
públicas mediante N-API y permite que getters e iteradores modifiquen el DOM o
reentren sin mantener un préstamo del árbol. Usa una pila explícita para recorrer
nodos. Las referencias necesarias entre pasos tienen ownership RAII, y cada paso
libera sus handles temporales. Las comprobaciones de memoria observan referencias
nativas, Document y Window por separado.

Los mapas de prefijos mantienen la herencia y las listas compartidas de la
referencia. Se preservan colisiones como constructor/__proto__, consultas repetidas
a atributos, IteratorClose al fallar y precedencia del error original sobre un error
de return. Los valores primitivos lanzados se vuelven a lanzar sin convertirlos a
Error. Un resultado dinámico de un Text raíz vuelve sin coerción; dentro de un
fragmento se aplica la coerción de concatenación, con hint default.

Las reglas se derivan de w3c-xmlserializer 5.0.0; su licencia MIT se conserva en
third-party/w3c-xmlserializer y en el paquete. Los caracteres/nombres XML reutilizan
xmlparser a través de los helpers existentes. No se sustituyen las reglas XML por
las de serialización HTML de html5ever/parse5.

## Contratos y correcciones

El [baseline](xml-serialization/baseline.log) pasó 155 contratos públicos antes
de migrar. La primera integración detectó que JsStringUtf16.as_slice incluía el
terminador C: se reemplazó por la conversión owned Utf16String, que conserva NULs
del contenido y recorta únicamente el terminador. Se preserva el [fallo original](xml-serialization/integration-before-utf16.log).

La cobertura ampliada detectó 11 diferencias: una lectura namespaceURI faltante,
conversión incorrecta de excepciones primitivas y coerción prematura de resultados.
Los [fallos](xml-serialization/effects-before.log) y los [177 contratos corregidos](xml-serialization/effects-fixed.log)
quedaron guardados. Con contratos nativos y forest, el [siguiente pase](xml-serialization/forest-contracts.log)
aprobó 181 tests. Se añadieron después dos casos de claves que producen símbolos:
N-API entrega la clave directamente a V8, que aplica ToPropertyKey.

Los dos fixtures WPT originales de domparsing se fijaron con hashes en el manifest.
El [primer pase](../compatibility/2026-09-14T21-17-04.729Z-linux-wpt.json) tuvo 42
resultados en paridad: 40 aprobados por el estándar y dos fallos compartidos.
No se cambiaron assertions ni se presenta esta comparación como WPT completo.

## Memoria

El [control focal inicial](../memory/2026-09-14T21-18-59.811Z-xml-serialization.json)
y el [pase de forest](../memory/2026-09-14T21-25-56.905Z-xml-serialization.json)
pasaron nueve ciclos cada uno: árboles profundos, errores durante getters con GC,
cierre de iteradores y un resultado dinámico conservado después de liberar el DOM.
Los contadores live/references/cleanupErrors quedaron en cero al terminar cada
llamada. Se observaron por separado callbacks, iteradores, errores, nodos, documentos
y ventanas. Las pruebas finitas no acreditan ausencia absoluta de fugas.

Los módulos de acceso N-API permiten dead_code únicamente en compilaciones cfg(test):
esas compilaciones omiten el registro de exports, y los tests Node ejercen los
entrypoints del addon real. Clippy en producción permanece activo; no se suprimen
diagnósticos de seguridad, tipos o lógica del serializador.

## Rendimiento

La [primera medición aislada](../benchmarks/2026-09-14T21-28-08.084Z-linux-x64.json)
guardó muestras crudas y verificó cada fila, escape, CDATA y hash de salida.
Preparación/parsing y validación están fuera del tramo medido. A 1.000 filas,
xml-serialize midió 73,432 ms frente a 21,611 ms en jsdom; innerHTML XML midió
85,638 ms frente a 24,313 ms. Son regresiones conservadas, no una aceleración.

## Validación final y distribución

[La validación completa](xml-serialization/validation.json) pasó formato, Clippy,
220 tests Rust, 1.301 Node, 8 Jest, 19 Vitest y 26 Vitest VM. La suite compartida
de los runners ejerce DOMParser, XMLSerializer e innerHTML/outerHTML XML reales.
HTML5 mantuvo 1.784 casos comparables y ocho exclusiones de scripting.

El [WPT general final](../compatibility/2026-09-14T21-38-09.606Z-linux-wpt.json)
registró 45.348 resultados en paridad: 44.290 aprobados por el estándar y 1.058
fallos compartidos. Range-deleteContents permanece bloqueado por el bootstrap de
la referencia. No se declara el corpus completo ni compatibilidad total del motor.

El [GC focal final](../memory/2026-09-14T21-40-45.381Z-xml-serialization.json) pasó
nueve ciclos. El [estrés general](../memory/2026-09-14T21-42-24.829Z-linux-x64.json)
aprobó los cinco modos: rustdom liberó 1.762 documentos y 882 ventanas observados;
cada modo Vitest liberó 1.760 documentos y 880 ventanas. Se conservaron deltas RSS
de 19,19 MiB, 40,00 MiB y 42,60 MiB para rustdom, vitest y vitest-vm.

[Memcheck](../memory/2026-09-14T21-42-24.000Z-xml-serialization-valgrind.log)
ejecutó los dos tests de helpers Rust de caracteres/escapado: cero errores y cero
bytes definitivamente o indirectamente perdidos, sin supresiones. Registra 48 bytes
posiblemente perdidos y 544 alcanzables de std/libtest. El ownership del puente
N-API se comprobó con los tests Node/GC, no con esos dos tests puros de Memcheck.

El paquete con SHA-256 `201957a1132faaca8afa10d2f00ebfce8be971e6f9520a443d13188937a8ee9e`
pasó 18 controles en [Node 24](../distribution/2026-09-14T21-43-54.665Z-linux-x64.json)
y 18 en [Node 22](../distribution/2026-09-14T21-46-25.907Z-linux-x64.json), con npm/pnpm,
tipos, CJS/ESM/VM, workers y runners reales. El repack final
`88aee091af3acd073c8eb4ef2ee94a9fd660fd2106a516e1e820b2860983aa7b` actualiza solo
README: la [auditoría de 703 archivos](xml-serialization/package-readme-audit.json)
comprueba igualdad de contenidos, modos y enlaces de runtime, tipos, dependencias
y licencias. No se afirma haber repetido los 36 controles sobre el SHA nuevo.

El binario validado y medido es
`c9914e3a9471161f2ec7807298e0b4c466c5489ef2a7a821497daf192b9cdb57`.
Los 11 tests del arnés de benchmarks también aprobaron. El hito queda validado
localmente para publicar en PR; el checkpoint en main requiere CI y revisión del SHA.

## Medición final

El [benchmark final aislado](../benchmarks/2026-09-14T21-51-52.690Z-linux-x64.json)
conserva 18 muestras por motor/operación, dos procesos por motor, tres warmups y
orden alternado. No hubo builds, tests o memoria concurrentes. Cada salida y error
se verificó fuera del tramo medido y se compararon hashes entre motores.

| Operación | Filas | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| xml-serialize | 100 | 3,014 | 9,139 | 0,33× |
| xml-inner-serialize | 100 | 3,327 | 10,427 | 0,32× |
| xml-document-serialize | 100 | 2,735 | 8,793 | 0,31× |
| xml-serialize-error | 100 | 3,379 | 11,542 | 0,29× |
| xml-serialize | 1000 | 22,406 | 78,875 | 0,28× |
| xml-inner-serialize | 1000 | 25,022 | 88,644 | 0,28× |
| xml-document-serialize | 1000 | 22,453 | 75,583 | 0,30× |
| xml-serialize-error | 1000 | 24,052 | 85,236 | 0,28× |

Ratio = mediana jsdom / mediana rustdom. Las cargas de 1.000 filas siguen siendo
unas 3,4–3,5 veces más lentas; el port de algoritmos no acredita la meta de alto
rendimiento. Se conservan tanto la primera medición como la final.
