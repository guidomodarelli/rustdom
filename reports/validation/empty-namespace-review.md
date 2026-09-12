# Revisión del namespace vacío

El hallazgo `3994917562` del PR #8 proponía normalizar el namespace vacío dentro
de `attributes.hasAttributeByNameNS`. Se descartó sin cambiar producción porque
`ElementImpl.hasAttributeNS` ya transforma `""` en `null` antes de llamar a ese
helper; el build privado conserva ese método de jsdom 27.4.0.

Se ejecutó un probe público con jsdom independiente y rustdom en Node 22.12.0 y
24.14.1. Un elemento tenía dos atributos `data-value`: uno sin namespace y otro
en `urn:namespace`. Las consultas con `""` y `null` devolvieron `true` y el valor
`plain`; tras `removeAttributeNS("", "data-value")`, ambas devolvieron `false` y
`null`. El atributo en `urn:namespace` permaneció accesible y un namespace
desconocido siguió devolviendo ausencia. Todos los resultados coincidieron entre
motores en ambos runtimes.

Los WPT de atributos también comprueban esa equivalencia y pasaron. La respuesta
del PR enlaza el método público de la revisión fijada de jsdom
`098d16d6b86c5f215d48658c3005cb54b1325603`, línea 309. El hallazgo quedó resuelto
como incorrecto, separado de los IDs de fixes aplicados en el estado del loop.
