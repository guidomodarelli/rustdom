# Transición atómica a colecciones canónicas

El baseline `4a7003adc9e71a725b91c4ed2b20bc6e148cad1d` aceptaba `initializeAttributeCollection` después de un snapshot con atributos. Creaba un índice vacío, mientras consultas y serialización todavía leían los atributos del snapshot; una mutación posterior podía descartarlos. La reproducción guardada en `baseline.log` obtuvo cinco fallas: cuatro caminos de snapshot no vacío y metadata de un nodo no-Element.

El guard consulta metadata existente antes de activar o crear la colección. Rechaza snapshots no vacíos sin índice canónico mediante `NonEmptyAttributeSnapshot` (`InvalidArg` en Node-API), y metadata no-Element mediante `NotElement`. La construcción previa a metadata, los snapshots Element vacíos y la reinicialización de colecciones canónicas pobladas conservan su comportamiento. No se fabrican Attr wrappers ni se cambia el contenido del snapshot.

El constructor JS inicializa la colección antes de hidratar metadata, y `data-bridge.cjs` utiliza los métodos dedicados `set*Metadata`. No se encontró un consumidor que necesitase sincronización automática desde un snapshot no vacío. En esa ruta normal previa a metadata, el guard agrega únicamente la consulta a `data`.

## Pruebas y memoria

Los tests del addon cubren `setData`, `setHtmlElement`, `setElementFromAttributes` y `setHtmlElementFromAttributes`, con 1.000 rechazos sucesivos por camino. Verifican estadísticas completas antes de nuevas lecturas, resultados de consultas y serialización, el cache de selectores, ownership e índices. También cubren snapshot vacío, handles reservados/inválidos, nodos de otros tipos e idempotencia con atributos canónicos.

`npm run validate` pasó en Linux/WSL con Node 24.14.1: formato, Clippy, **43 tests Rust, 187 Node, 7 Jest, 11 Vitest, 4 VM**, 1.784 comparaciones HTML5 y 390 WPT. HTML5 mantiene ocho exclusiones script-on; WPT conserva 388 aprobados y dos fallas de adopción compartidas con jsdom. Los estados y logs completos están en esta carpeta. Las 12 regresiones focales también pasaron con Node 22.12.0 (`node22.log`).

La prueba de GC usa el endpoint existente y un control fuertemente retenido: ese control impide alcanzar el endpoint; al liberarlo, desaparecen las 64 instancias NativeTree observadas. Las trazas de [Node 22](../../memory/collection-initialization-node22.json) y [Node 24](../../memory/collection-initialization-node24.json) conservan las muestras escalares. Esta prueba observa wrappers y no mide por sí sola todos los bytes nativos.

`npm run test:memory` pasó en los cinco modos. Rustdom liberó los 881 documentos y 881 proxies de ventana observados, con crecimiento retenido de 0,70 MiB de heap y 4,35 MiB de RSS. El [reporte completo](../../memory/2026-09-12T04-44-12.475Z-linux-x64.json) conserva muestras, hashes y límites.

Las tres regresiones Rust nuevas pasaron además Memcheck 3.18.1, con `--leak-check=full`, `--show-leak-kinds=all`, `--track-origins=yes` y sin supresiones. Cada log mantiene cero errores y cero pérdidas definitivas/indirectas, junto a los 48 bytes `possibly lost` y 544 bytes `still reachable` del harness/runtime Rust. Fue una ejecución focal; no se afirma haber repetido toda la suite bajo Memcheck. El guard no guarda referencias adicionales ni modifica ownership en errores; las pruebas finitas no demuestran ausencia absoluta de fugas.

## Costo del hot path

`node benchmarks/collection-initialization.cjs <baseline.node> <candidate.node>` compara cuatro procesos aislados con orden alternado. Usa 512 elementos residentes, tres warmups y nueve muestras por proceso de 10.000 ciclos reserva/inicialización/metadata/liberación. Incluye verificaciones de estado y deja carga de módulos, preparación y GC explícito fuera del intervalo. Es una medición de API nativa, no del DOM completo ni de Jest/Vitest.

La [ejecución aislada](../../benchmarks/2026-09-12T04-40-33.743Z-collection-initialization.json) registró 18 muestras por variante: **8,462 ms** de mediana baseline y **8,052 ms** candidato, relación **1,051×**. Los rangos se superponen; no se afirma una mejora general a partir de esta única máquina. Todas las muestras y hashes permanecen guardados.
