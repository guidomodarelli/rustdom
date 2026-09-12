# Validación del almacenamiento reforzado de atributos

`npm run validate` pasó con el almacenamiento que conserva la capacidad previa a los borrados y reconstruye tablas dispersas, incluso con tombstones: formato, Clippy, 32 tests Rust, build, 134 Node, 7 Jest, 11 Vitest, 4 VM, 1784 casos HTML5 y 390 WPT en paridad con jsdom 27.4.0. De estos últimos, 388 pasan el estándar y dos fallan igual que jsdom.

El addon ejecutado tiene SHA-256 `362cfe5c52d0b989eaa4e87006e470211fc1a52547594416741e58b356cd627f`. Parte del commit base `0f40cc06e7f25cac80d3b656e48528f1eaa43fba`; los cambios de producción se limitan a `attribute_index.rs` y el nuevo módulo privado `attribute_storage.rs`. No agrega dependencias ni exports de diagnóstico.

Las nueve regresiones Rust nuevas cubren capacidad residual en elementos vivos, buckets de nombres duplicados, alias válidos con orden vacío, tablas globales, sets compartidos, propietarios iniciales, orden de finalización y colisiones extremas en mapas/sets. En el último caso, reinsertar una entrada comprueba que la tabla ya no recupera los miles de slots que los tombstones ocultaban.

La prueba DOM mantiene cuatro ráfagas de 2048 atributos sobre el mismo documento/elemento y compara nombres, orden, identidades, propietarios y alias con la referencia independiente. La medición de memoria adicional mantiene vivos esos contenedores durante cinco ráfagas de 2048 atributos, después de tres warmups iguales; sus resultados se guardan en `reports/memory/2026-09-12T02-36-25.657Z-attribute-capacity.json`.

Los reportes `attribute-capacity/` conservan la ejecución preliminar anterior al refuerzo de tombstones. La comparación de rendimiento usa addons aislados de la misma base y guarda inserción, eliminación y el ciclo completo, incluyendo el coste de recrecer las tablas.

Los logs de consola se normalizaron a LF y sin espacios/líneas vacías finales para su almacenamiento en Git. Los JSON con casos, resultados y muestras numéricas se conservan completos.
