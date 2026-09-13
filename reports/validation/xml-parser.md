# Contratos de referencia para migrar XML

El [baseline](xml-parser/baseline.log) pasó 46 tests reales. La
[captura completa](../compatibility/2026-09-13T18-32-15.169Z-xml-contracts.json)
guarda árboles, atributos ordenados, namespaces/prefijos, owners de templates,
serialización, errores exactos, documentos parciales y efectos de scripts.
También cubre fragmentos con resolución de prefijos del contexto y documentos
parsererror de DOMParser. Este baseline todavía ejecuta saxes en ambos motores;
no acredita parsing XML nativo ni cierre de la fase.

Un caso verifica que un script ejecutado antes de un error posterior conserve
su efecto. Por eso no basta con validar todo el input antes de construir el
documento: la integración debe preservar el orden de tokens y callbacks. Los
errores de fragmento deben dejar intacto el árbol que se pretendía reemplazar,
sin ocultar efectos externos anteriores del parser.

## Primitivas evaluadas

- xml5ever0.39 ya está en el árbol de dependencias. Su fuente local declara XML5
  con recuperación, namespaces parciales y DTD fuera de alcance; no reemplaza
  directamente al parser de la referencia.
- [xmlparser0.13.6](https://docs.rs/xmlparser/0.13.6/xmlparser/) ofrece tokenización
  y primitivas XML1.0 sin asignaciones. No valida estructura de árbol ni atributos
  duplicados y solo recibe UTF8. Se seleccionó como biblioteca de primitivas;
  no se confunde con la capa completa de compatibilidad.
- [quick-xml](https://docs.rs/quick-xml/0.42.0/quick_xml/reader/struct.Config.html)
  ofrece controles configurables para comentarios y cierres, pero esos controles
  no prueban equivalencia con errores, entidades y comportamiento de saxes.

La referencia real es saxes6.0.0, forzada a XML1.0 y namespaces. Sus eventos,
mensajes, posiciones y reglas de entidades deben preservarse explícitamente.
La entrada debe conservar UTF16: convertirla con pérdida a UTF8 cambiaría casos
de surrogates aislados y el momento de los errores. Los detalles observados en
la referencia deben verificarse con contratos, no corregirse hacia otro parser
sin documentar la diferencia de compatibilidad.

## Trabajo pendiente

Implementar el parser/controlador Rust con puntos de retorno al host para
resolución de namespaces y creación/ejecución de elementos, integrar documentos
y fragmentos, ampliar corpus, probar GC y medir cargas equivalentes. No cerrar
XML con un subset válido, recuperación silenciosa o fallback JavaScript.
