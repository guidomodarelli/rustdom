# Restricciones de reemplazo y módulo nativo compartido

`preReplaceConstraints` decide las restricciones posteriores a los controles
originales de contenedor y ciclos. Comparte validación de handles, pertenencia,
tipos y lectura de hijos con `preInsertConstraints`; las reglas de Document
permanecen explícitas para cada algoritmo. El nuevo módulo `node_constraints.rs`
reemplaza `node_insertion.rs` sin cambiar la API de inserción existente.

El reemplazo excluye solamente al hijo reemplazado de las restricciones de
Element/DocumentType. El caso de fragmento conserva el conteo exacto de un
elemento que usa jsdom 27, y los controles de hermanos siguen siendo inmediatos.
Las decisiones son escalares, no mutan el árbol ni mantienen referencias.
Los efectos de adopción/remoción/inserción y la entrega de observers quedan
en el driver original, después del préstamo nativo.

El puente comparte el formato de errores y conserva el realm del padre.
Los fixtures reales de inserción/reemplazo se comparten en un helper de tests,
sin mocks de plataforma. Los tests de inserción previos se conservaron.

Pasaron **8 tests Rust**, Clippy/build y **16 contratos Node existentes**
de inserción, árbol y Range. Luego pasaron los ocho tests de inserción y
reemplazo juntos, con **524 escenarios reales de reemplazo** contra jsdom.
Cubren candidatos nuevos, el mismo nodo y hermanos existentes, identidades,
adopción, errores sin efectos, rangos vivos, registros MutationObserver,
reacciones conectadas reentrantes, realms y handles nativos inválidos.

El [Memcheck focal](../memory/2026-09-12T21-31-31.286Z-node-constraints-valgrind.log)
pasó los ocho tests del módulo compartido con cero errores y cero pérdidas
definitivas o indirectas. Los 48 bytes posibles y 544 alcanzables de std/libtest
permanecen visibles sin supresión; se guarda el hash del ejecutable.

## Cohesión y tamaño

El módulo principal pasó de 284 a 526 líneas, contando los tests Rust internos.
Los archivos completos implicados pasaron de 2.983 a 3.397 líneas al agregar
reemplazo y su cobertura. Los adaptadores compartidos incluyen otras operaciones,
por lo que esa segunda cifra describe el alcance de archivos, no solo estas funciones.
La mejora es compartir reglas y fixtures que ya tienen dos consumidores;
no se presenta como una reducción total de líneas.

La validación integral aprobó **129 tests Rust, 469 contratos Node,
7 Jest, 18 Vitest y 26 en pools VM**, además de 1.784 casos HTML5 comparables.
El [reporte WPT](../compatibility/2026-09-12T21-37-52.372Z-linux-wpt.json) mantiene
43.708 casos en paridad, 42.678 aprobados por el estándar y 1.030 fallos
compartidos. El bootstrap bloqueado de Range-deleteContents sigue declarado.

El [estrés de memoria](../memory/2026-09-12T21-40-33.637Z-linux-x64.json) pasó
en cinco modos, sin supervivientes de los documentos/ventanas observados:
882 en rustdom y 880 por modo Vitest. Los deltas de heap/RSS fueron
2,59/20,43 MiB en rustdom, 3,82/36,97 MiB en Vitest normal y 3,43/37,80 MiB en VM.
Se conservan los escenarios de reemplazo y referencias externas tras teardown;
son pruebas finitas, no una demostración absoluta de ausencia de fugas.

El paquete con SHA-256
`5e19254566e32957e9ac8e72c125c2eaf3406de0afdcb358b990f50d7471776c`
pasó **18 controles** en [Node 24](../distribution/2026-09-12T21-37-14.651Z-linux-x64.json)
y **18 en Node 22.12** [en este reporte](../distribution/2026-09-12T21-37-33.663Z-linux-x64.json),
con instalaciones npm/pnpm y consumidores CJS/ESM reales.

## Rendimiento

El [benchmark compartido](../benchmarks/2026-09-12T21-44-10.938Z-linux-x64.json)
se ejecutó sin otros runners locales. Mide 100 operaciones públicas por muestra;
candidatos y referencias se preparan antes, y datos, conteos, identidades y
hashes se comprueban fuera del tiempo medido. Se conservan todas las muestras.

| Operación, 100 intentos | Comentarios previos | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Insertar comentarios | 250 | 0,837 | 0,600 | 1,39× |
| Rechazar elementos duplicados | 250 | 3,195 | 3,213 | 0,99× |
| Insertar comentarios | 1.000 | 2,069 | 0,570 | 3,63× |
| Rechazar elementos duplicados | 1.000 | 4,699 | 3,105 | 1,51× |
| Reemplazar comentarios | 250 | 3,666 | 3,488 | 1,05× |
| Reemplazar elemento raíz | 250 | 1,574 | 2,021 | 0,78× |
| Reemplazar comentarios | 1.000 | 11,080 | 9,625 | 1,15× |
| Reemplazar elemento raíz | 1.000 | 3,635 | 4,093 | 0,89× |

El ratio divide tiempo jsdom por tiempo rustdom. El reemplazo de comentarios
queda cerca de la paridad con una mejora pequeña; reemplazar repetidamente el
elemento raíz sigue siendo más lento. La repetición de inserciones conserva
ganancias en los patrones medidos. Las diferencias entre ejecuciones históricas
no aíslan causalmente el refactor y no justifican una mejora universal del DOM.
