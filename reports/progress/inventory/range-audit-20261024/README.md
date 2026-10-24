# Propuesta de clasificación de Range

Esta entrega audita tres módulos y 31 entradas de API de la referencia fijada
jsdom 27.4.0. Es una propuesta separada: **no modifica el catálogo canónico**.
Su prueba actual fija tres módulos híbridos y está incluida en los 563 archivos
del estudio en curso; integrar la propuesta requiere actualizar ese contrato
cuando termine la captura, probarlo y revisar el cambio.

| Dimensión propuesta | Híbrido | Pendiente | Rust completo |
| --- | ---: | ---: | ---: |
| Módulos | 3 | 0 | 0 |
| APIs | 27 | 4 | 0 |

Las cuatro APIs pendientes son el constructor ilegal de AbstractRange, los
getters startContainer/endContainer y Range.detach. Sus rutas públicas siguen
en JavaScript. No se cuenta otra vez la herencia de los getters en Range y
StaticRange; tampoco se reclasifican constantes ni símbolos de marca.

`audits.json` contiene solo las 34 filas nuevas. `merged-audits.json` agrega las
cinco clasificaciones canónicas anteriores sin cambiarlas, para reproducir el
CLI con `--audits`. `source-map.json` fija las 20 fuentes locales inspeccionadas
y el HEAD de esa inspección; no atribuye ese HEAD al build completo de A0.
Las cantidades resultantes de ambos Node y sus hashes se conservan con la QA.

Rust conserva endpoints/offsets, igualdad, límites, comparaciones, topología,
selección de texto y planes de contenidos. JavaScript conserva WebIDL,
constructores, validaciones de StaticRange, referencias visibles al GC,
factories, la entrega de mutaciones y partes de inserción/surround/parsing.
El collapse publicado usa collapsePlan; el candidato con una sola actualización
atómica sigue aislado y no acredita estos consumidores.

Para retirar los módulos completos falta llevar las decisiones restantes a
Rust, conservar solo el puente necesario para Node/GC/realms y probar sus
consumidores públicos, errores, reentrada y teardown. La creación contextual
de fragmentos también depende del parser y de las factories aún híbridas.
No se aprueba una ancla Rust adicional ni se cierra una fase con esta propuesta.

Los denominadores siguen siendo 531 archivos, 4331 APIs y 7246 anclas, como
dimensiones separadas. La agrupación normativa de algoritmos y las brechas de
dependencias/contratos dinámicos siguen abiertas: migrationPercent permanece
null. Auditar más filas no demuestra que haya aumentado la implementación Rust.

Evidencia y reproducción:
`reports/validation/inventory-range-audit/20261024/`.
