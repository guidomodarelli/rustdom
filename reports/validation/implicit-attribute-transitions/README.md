# Frontera completa de colecciones y ownership de atributos

El baseline `2f128fe193c2e0678956c87ba5e5da96a6996a54` protegía la inicialización explícita, pero las mutaciones inicializaban directamente el índice. La matriz inicial conservada en `baseline.log` reprodujo 37 fallas y dos controles válidos. `owner-baseline.json` confirmó además que un owner sin índice permitía borrar atributos al cambiar su valor, y que actualizar metadata podía vaciar un snapshot. Liberar un Attr constructor-only, en cambio, no refrescaba ese snapshot; se conserva esa distinción.

## Auditoría y cambios

| Entrada | Frontera y comportamiento |
| --- | --- |
| `initializeAttributeCollection` | Delega a una única inicialización interna con preflight, permitiendo construcción antes de metadata e idempotencia. |
| `appendAttribute`, `removeAttribute`, `replaceAttribute` | Validan todos los handles y reglas de Attr/ownership antes de pasar por la inicialización común. No crean un índice al rechazar un snapshot no vacío. |
| `setAttribute` | El no-op requiere una entrada canónica existente; los demás casos delegan a append/replace protegidos. |
| `initializeAttributeOwner` | Valida Attr, referencias y Element antes de inicializar la colección. El owner válido sella el estado canónico, impidiendo un `setData` posterior que mezcle modelos. `null` conserva el no-op previo para Attr sin referencias. |
| `set*Metadata` | Comparte la barrera de snapshot no vacío sin índice. Conserva metadata inicial y retipados permitidos; no introduce una exigencia nueva sobre el tipo previo del nodo. |
| `setData`, `setHtmlElement`, `set*FromAttributes` | Siguen siendo reemplazos deliberados de snapshot antes del estado canónico. No se les aplica la barrera de actualización de metadata. |
| Valor de Attr | Los owners admitidos ya tienen índice canónico; cambiar un Attr cuyo owner fue rechazado no puede modificar el snapshot copiado. |
| Refresh y release | Sin índice, el refresh conserva el snapshot válido. No oculta metadata inexistente/de tipo incorrecto ni Attr canónicos inválidos. Release refresca holders canónicos; los owners constructor-only se limpian sin inventar atributos. |

Sólo queda una llamada de producción a `attribute_collections.initialize`, dentro de la inicialización validada. Las llamadas directas restantes pertenecen a tests del almacenamiento, que no posee metadata. Se revisaron también `set_initial_owner`, todos los callers de `refresh_attribute_cache`, `set_attribute_value` y `release_node`. No se cambian los inicializadores deliberados ni se fabrican wrappers Attr.

## Validación

`npm run validate` pasó con **48 tests Rust, 227 Node, 7 Jest, 11 Vitest y 4 VM**, además de 1.784 comparaciones HTML5 y 390 WPT. HTML5 mantiene ocho exclusiones script-on; WPT conserva 388 aprobados y dos fallas de adopción compartidas con jsdom.

Dos controles de ownership/metadata se agregaron al cerrar la matriz y se ejecutaron en el foco final, no dentro del conteo 227 de esa ejecución completa. La matriz final de **42 casos pasó en Node 22.12.0 y Node 24.14.1**, incluyendo cuatro formatos de snapshot, las cuatro mutaciones, ownership, metadata, errores repetidos, handles inválidos, no-ops, retipados y preservación de selectores/serialización/cache. Los logs `node22.log` y `node24.log` contienen esos resultados.

La prueba de GC ejercita 3.584 rechazos sobre 32 instancias NativeTree, usa un control retenido y luego exige cero wrappers supervivientes con el endpoint existente. Las trazas de [Node 22](../../memory/implicit-attributes-node22.json) y [Node 24](../../memory/implicit-attributes-node24.json) se guardan por separado. No se interpreta la desaparición del wrapper como una medición exhaustiva de bytes nativos.

Memcheck 3.18.1 pasó las cinco regresiones Rust focales, incluidas la ausencia de índice y un índice canónico inválido: cero errores de acceso y pérdidas definitivas/indirectas, sin supresiones. Permanecen visibles 48 bytes `possibly lost` y 544 bytes `still reachable` del harness/runtime Rust. `memcheck.log` y `memcheck-tests.log` conservan los diagnósticos; no se afirma haber repetido toda la suite bajo Memcheck.

El [chequeo general de memoria](../../memory/2026-09-12T05-41-10.994Z-linux-x64.json) pasó en cinco modos. Rustdom liberó los 881 documentos y 881 ventanas observados; el crecimiento retenido fue 0,70 MiB de heap y 3,62 MiB de RSS. Las pruebas finitas no prueban ausencia absoluta de fugas.

## Rendimiento

Se reutilizó `benchmarks/attribute-capacity.cjs` con addons release aislados, orden alternado y todas las muestras conservadas. La [medición ejecutada](../../benchmarks/2026-09-12T05-38-19.367Z-attribute-capacity.json) mostró:

| Ciclo completo | Baseline, mediana | Candidato, mediana | Baseline/candidato |
| --- | ---: | ---: | ---: |
| 32 atributos | 0,14956 ms | 0,15941 ms | 0,938× |
| 1.024 atributos | 85,833 ms | 84,580 ms | 1,015× |

El caso pequeño conserva una regresión de mediana; el grande queda cercano al baseline. No se afirma una mejora general ni se omiten muestras. La medición cubre API nativa, índices, refresh y transferencias Node-API, no suites completas de DOM/Jest/Vitest.
