# Ejecución completa de Memcheck por lotes

El CI de PR65 en `8e3a2f7` terminó por el watchdog de 600 segundos del proceso
único de Valgrind. El [job de Linux](https://github.com/guidomodarelli/rustdom/actions/runs/34928151076/job/104250510252)
llegó a la prueba del árbol de 10.000 niveles después de las pruebas anteriores.
El [reporte original](native-memory-batches/ci-timeout.json) registra
`SIGTERM` y `spawnSync valgrind ETIMEDOUT`. El [log de Memcheck](native-memory-batches/ci-timeout-valgrind.log)
no registró errores ni fugas definitivas/indirectas hasta el corte; al no haber
terminado el proceso, ese resultado sigue siendo un fallo de validación.

`scripts/native-memory.mjs` descubre el inventario del ejecutable real mediante
libtest y lo divide en lotes de hasta 32 nombres exactos. Se ejecutan todos los
casos una vez, con los mismos tamaños, aserciones, un thread y flags de Memcheck.
Cada proceso conserva el límite de 600 segundos. No se agregan supresiones ni
reintentos que conviertan un fallo de memoria en éxito.

El reporte guarda inventario, comandos, nombres, hash del binario, duración,
stdout y diagnóstico de cada lote. Exige que libtest confirme que pasaron todos
los casos seleccionados, sin casos ignorados. Una interrupción conserva el
progreso anterior con `pass: false`; solo el cierre completo puede aprobar.

La [validación del planificador](native-memory-batches/validation-tests.log)
pasó los tres casos nuevos y los seis controles existentes del ejecutor. Una
primera invocación directa de Node no proporcionó `npm_execpath` a la integración
existente; el [log inicial](native-memory-batches/harness-tests.log) se conserva.
La repetición con el comando correcto `npm run test:validation` pasó los nueve.
La [ejecución real de Memcheck](../memory/2026-09-15T05-26-11.882Z-valgrind.json)
pasó los 241 tests en ocho lotes, sin errores ni fugas definitivas/indirectas.
El lote del árbol profundo tardó 354,69 segundos; el total de los ocho procesos
fue 461,63 segundos. Los logs conservan 48 bytes posiblemente perdidos y 544
alcanzables por el runtime de tests. No se agregaron supresiones. El gate valida
el ejecutable Rust; el addon y V8 se analizan por separado en el hito FileReader.

El mismo CI también ejecuta WPT. Se corrigió una comparación inestable detectada
en el corpus general: el diagnóstico de un fallo compartido de Blob incorpora
la hora de `new Date()`. `tests/wpt/comparison.cjs` canoniza únicamente la
descripción de ese input, en el archivo/test exactos y con estado fallido.
Los mensajes crudos permanecen intactos; los errores obtenidos y esperados,
otros mensajes, nombres, estados y fallos del harness siguen comparándose.
Sus [tres pruebas de regresión](native-memory-batches/wpt-comparison-tests.log)
pasaron; la [repetición del corpus original](native-memory-batches/wpt-revalidation.json)
mantuvo paridad en todos los resultados ejecutados. Ese corpus incluye el
FileReader en desarrollo de la rama actual; no se atribuye a una ejecución
del SHA anterior de PR65. Los cambios de este ajuste afectan al workflow,
ejecutor, comparador, sus pruebas y reportes.

El workflow también evita duplicar la matriz completa en cada actualización
de un PR: conserva `pull_request` para ramas en revisión y `push` a `main`
para la integración. Antes, el mismo SHA de PR65 disparó dos ejecuciones
completas (runs 34928151076 y 34928156269). Los tres sistemas, cuatro shards
y el gate agregado se mantienen. Una rama sin PR conserva la validación local;
la validación remota previa al merge empieza al abrir el PR.
El workflow pasó [actionlint 1.7.12](native-memory-batches/actionlint.log);
no se ejecutó el ShellCheck externo.
