# Inicializadores de snapshots y colecciones canónicas

El fix del PR 8 separa la escritura de snapshots de la actualización de metadata. En el baseline `0e046176b1367fed802b6099bdcbcd2f65896aad`, `setData`, `setHtmlElement` y ambos métodos `FromAttributes` podían recibir atributos y descartarlos silenciosamente cuando el elemento ya tenía una colección canónica. La regresión del addon reprodujo cuatro fallos (`Missing expected exception`) y cinco casos válidos aprobados antes del fix.

`replace_snapshot` comprueba la precondición sin modificar el árbol y devuelve `TreeError::AttributeCollectionInitialized`; el borde Node-API conserva su contrato `InvalidArg` y agrega una explicación accionable. La limitación también se aplica a una lista vacía, porque un snapshot vacío no puede significar simultáneamente reemplazar atributos y conservar la colección. Los APIs `setElementMetadata` y `setHtmlElementMetadata` mantienen el camino de commit que preserva la colección y sus owners.

Las pruebas cubren los cuatro inicializadores con colecciones vacías/pobladas y listas entrantes vacías/con atributos. Comprueban metadata serializada, IDs ordenados, owners, contadores nativos y reservas de template intactas al rechazar. También conservan la inicialización válida previa a una colección y la actualización de templates con atributos. Se agregaron 4.000 rechazos sucesivos sobre un árbol vivo para verificar que no crezcan las estructuras nativas y que su liberación deje los contadores en cero.

El primer gate Rust aprobó 21/22 pruebas y detectó que el test Unicode anterior usaba `set_data` para modificar metadata después de activar la colección. Se migró ese setup a `set_element_metadata`, sin cambiar las aserciones Unicode. Se conserva el resultado original en `native-initialization-before-test-migration.json` y su log.

## Validación ejecutada

`npm run validate` pasó en Linux/WSL con Node 24.14.1: formato, Clippy, 22 pruebas Rust, build release, 130 pruebas Node (incluidas las 11 nuevas), 7 Jest, 11 Vitest y 4 VM. El corpus HTML5 comparó 1.784 casos sin diferencias y mantuvo sus 8 exclusiones script-on. WPT conservó la paridad en 390 casos: 388 aprobados y 2 fallas de adopción compartidas con jsdom, sin diferencias nuevas.

Los comandos, estados y logs completos se conservan en `native-initialization-run/`. El mismo addon pasó además las 11 regresiones nuevas con Node 22.12.0; la salida TAP está en `native-initialization-node22.log`. Estas ejecuciones locales corresponden a Linux; la aceptación en Windows y macOS pertenece a los checks del PR.

## Memoria y límites

El guard agrega un lookup de IDs y un error con un identificador escalar; no agrega caches, referencias JavaScript ni ownership persistente. Los snapshots decodificados y sus copias de atributos siguen siendo valores Rust locales destruidos al retornar. Las pruebas verifican contadores estables durante los rechazos y liberación posterior de nodos, owners y holders. Esto no demuestra ausencia absoluta de fugas ni sustituye las pruebas de GC y recursos del proyecto.

`npm run test:memory` pasó en los cinco modos. Rustdom liberó los 880 documentos, 880 proxies de ventana y 2.320 atributos observados; su heap retenido creció 0,66 MiB y RSS 5,04 MiB después del warmup. El modo nativo tuvo 0,75 MiB de crecimiento de RSS. Ambos entornos Vitest liberaron sus 440 documentos y ventanas observados por modo. Las muestras completas, hashes y límites están en [el reporte de memoria](../memory/2026-09-12T01-25-27.890Z-linux-x64.json).

La ruta normal del DOM usa los APIs de metadata y mutaciones de atributos. El cambio no migra nuevos módulos a Rust ni acredita una mejora de rendimiento. Los benchmarks del hito se conservan por separado; sus mediciones no se ejecutan simultáneamente con estos builds/tests.
