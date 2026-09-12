# Activación atómica de metadata

El baseline `0f40cc06e7f25cac80d3b656e48528f1eaa43fba` activaba el nodo de destino antes de validar `templateContent`. Un template inválido devolvía error, pero cambiaba `liveNodes`, `capacity`, `allocations` y `reservedHandles`. La repetición de 1.000 errores sobre el lote reservado materializó los 128 nodos, sin metadata. Se conserva la reproducción en `baseline.log`: 5 fallas y 9 casos válidos antes del fix.

`replace_data` valida el destino y la referencia de template antes de activar cualquiera. No utiliza rollback ni compensa contadores después de un error. Para metadata sin template se conserva la validación y activación existente del único handle, evitando un lookup adicional en esa ruta frecuente.

La corrección se comparte entre `setElementMetadata`, `setData`, `setElementFromAttributes` e `initializeAttribute`. Las pruebas del addon cubren handles negativos, fraccionarios, fuera del rango seguro, desconocidos y liberados, tanto en el destino como en el template. El núcleo Rust cubre además `NaN` e infinito en los datos internos. Las pruebas preservan referencias compartidas, handles activos, `templateContent=0` y `templateContent=self`; este último ya era aceptado por la API de bajo nivel y no debe activarse dos veces.

## Memoria y alcance

Los errores ya no materializan registros nativos ni consumen reservas. La prueba de repetición exige estadísticas completas idénticas y verifica liberación del lote. El preflight sólo consulta las tablas existentes; no agrega referencias JavaScript, caches, ownership ni estructuras persistentes. Los payloads temporales se destruyen al retornar. Las pruebas finitas no demuestran ausencia absoluta de fugas.

La revisión del mismo patrón detectó rutas equivalentes en inserciones, consultas y serialización, conservadas en `related-routes-baseline.jsonl`. Esa ampliación está autorizada y se implementa en un segundo commit con pruebas separadas, para no atribuir su corrección a esta capa de metadata. Los contadores diagnósticos de intentos de consulta deben conservar su comportamiento.

## Validación ejecutada

`npm run validate` pasó en Linux/WSL con Node 24.14.1: formato, Clippy, 25 tests Rust, build release, 148 tests Node, 7 Jest, 11 Vitest, 4 VM y 1.784 comparaciones HTML5 sin diferencias. El corpus mantiene 8 exclusiones script-on. WPT conserva paridad en 390 casos: 388 aprobados y 2 fallas conocidas compartidas con jsdom. Los logs y estados de los gates están junto a este informe. Las 15 regresiones del addon también pasaron con Node 22.12.0 (`node22.log`).

`npm run test:memory` pasó en los cinco modos. Rustdom liberó los 880 documentos y 880 ventanas observados; el crecimiento retenido fue 0,67 MiB de heap y 4,52 MiB de RSS. El modo nativo mostró 0,75 MiB de crecimiento de RSS. Las muestras y límites están en [el reporte de memoria](../../memory/2026-09-12T02-11-05.843Z-linux-x64.json). Estas ejecuciones locales no sustituyen los checks del PR para Windows y macOS.
