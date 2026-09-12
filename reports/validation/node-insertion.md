# Restricciones de inserción en Rust

Node conserva primero los controles originales de tipo del contenedor y
ciclos que incluyen hosts. Después, `preInsertConstraints` decide en Rust
la pertenencia del hijo de referencia, los tipos de nodo insertables, las
parejas de tipo padre/nodo y las restricciones de estructura de Document.
El resultado es un enum sin referencias ni estado persistente. La creación
de DOMException se entrega al realm del padre después del préstamo nativo.

La consulta no adopta, inserta ni elimina nodos. Los drivers originales
conservan esos efectos tras la validación. Eliminar arrays intermedios de
hijos evita copiarlos a JavaScript para consultar restricciones de Document.
Los controles previos y otros algoritmos de Node siguen pendientes de migración.

Se conserva el comportamiento del jsdom fijado: Text y CDATA se distinguen
en estas restricciones y los controles relativos a DocumentType consultan
hermanos inmediatos. Los tests cubren también comentarios intermedios y la
inserción de un elemento que ya pertenece al documento.

Pasaron **4 tests Rust**, Clippy/build y **16 contratos Node focales** de
inserción, árbol y Range. Después se amplió y repitió la matriz a **672
combinaciones** de padre/nodo/referencia, incluidas referencias al último hijo.
Las comparaciones comprueban diagnósticos, identidad del nodo devuelto,
adopción, hijos, registros MutationObserver y ausencia de cambios ante errores.
También se comprueban ciclos de ShadowRoot/templates, realms y conversión pública.

El [Memcheck focal](../memory/2026-09-12T20-01-58.371Z-node-insertion-valgrind.log)
pasó los cuatro tests nuevos con cero errores y cero pérdidas definitivas
o indirectas. Conserva 48 bytes posibles y 544 alcanzables de std/libtest,
sin supresión; el hash del ejecutable acompaña los logs. La suite nativa
completa se analizó en el hito anterior; este control está acotado al módulo nuevo.

Se agregan consumidores CJS/ESM, observación débil de nodos rechazados en
el estrés de memoria y benchmarks de inserciones aceptadas/rechazadas en
documentos con 250/1.000 comentarios.

La validación integral terminó con **125 tests Rust, 330 contratos Node,
7 Jest, 11 Vitest y 4 en pools VM** aprobados. También pasaron 1.784 casos
HTML5 comparables. El [reporte WPT](../compatibility/2026-09-12T20-08-47.983Z-linux-wpt.json)
mantiene 43.708 casos en paridad: 42.678 aprobados por el estándar y 1.030
fallos compartidos. El bootstrap bloqueado de Range-deleteContents permanece
declarado, sin modificar fixtures ni contarlo como una aprobación.

El [estrés de memoria](../memory/2026-09-12T20-13-48.117Z-linux-x64.json) pasó
en cinco modos. rustdom terminó con cero supervivientes de 882 documentos,
882 ventanas, 7.000 nodos observados y 1.500 rangos; cada modo Vitest liberó
440 documentos/ventanas, 3.960 nodos y 1.760 rangos. La observación ahora incluye
los Text rechazados como hijos de Document. El crecimiento final fue 2,55 MiB
de heap y 19,50 MiB de RSS para rustdom. Son controles finitos, no una prueba
absoluta de ausencia de fugas.

El paquete con SHA-256
`df1ab79281a2cccb24928e8ee75f69839cc7aefb8f8c178fe2f1f2296e4dea81`
pasó **18 controles** en [Node 24](../distribution/2026-09-12T20-18-40.406Z-linux-x64.json)
y **18 en Node 22.12** [en este reporte](../distribution/2026-09-12T20-19-00.070Z-linux-x64.json).
Son instalaciones npm/pnpm reales con tipos, CJS/ESM, workers y runners.
Se reforzaron después las aserciones de identidad exacta de hijos en la matriz
y el benchmark; la matriz focal volvió a pasar sus cuatro tests sin cambios
en las fuentes del runtime ni en el paquete.

## Rendimiento

El [benchmark](../benchmarks/2026-09-12T20-24-03.839Z-linux-x64.json) se ejecutó
sin otros runners locales, en una ventana coordinada con la otra tarea.
Prepara un documento XML auxiliar con 250/1.000 comentarios y 100 candidatos
fuera del tiempo medido. Se mide appendChild completo, incluida la creación
de excepciones en los rechazos; identidades, conteos y hashes se verifican después.
Los procesos alternan motores y conservan todas las muestras.

| Operación, 100 intentos | Comentarios previos | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Insertar comentarios | 250 | 0,853 | 0,540 | 1,58× |
| Rechazar elementos duplicados | 250 | 2,722 | 2,753 | 0,99× |
| Insertar comentarios | 1.000 | 2,001 | 0,469 | 4,27× |
| Rechazar elementos duplicados | 1.000 | 4,478 | 2,560 | 1,75× |

El ratio divide tiempo jsdom por tiempo rustdom. Se observa una mejora en
inserciones y en el rechazo del caso grande; el rechazo pequeño queda cerca
de la paridad. Es una comparación de estos patrones contra jsdom, no una
medición causal contra el commit anterior ni una mejora universal del DOM.
