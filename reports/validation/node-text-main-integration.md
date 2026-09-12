# Integración de setters con los entornos actualizados

El PR de setters incorporó `main` en `402c7276430ba828db08097632cf7b044562702f`,
que contiene las correcciones de entornos y APIs de PR24. El merge local
`8901922189383f839522bd9afdd11345bf87907e` no tuvo conflictos.

No cambió el código de `src/dom`, el adaptador ESM nativo, los tipos nativos
ni el parche de build respecto a la cabeza anterior de setters. Se conservan
las pruebas y el Memcheck de ese núcleo; esta validación vuelve a ejercer la
combinación con los nuevos entornos, lectores de formularios y controles de cleanup.

Pasaron **121 tests Rust, 461 contratos Node, 7 Jest, 18 Vitest y 26 en pools
VM**, además de los 1.784 casos HTML5 comparables. El [reporte WPT](../compatibility/2026-09-12T20-46-16.733Z-linux-wpt.json)
también pasó: 43.708 casos en paridad, con 42.678 aprobados por el estándar y
1.030 fallos compartidos. El bootstrap CDATA bloqueado permanece declarado.
Los resultados anteriores de setters conservan sus commits y hashes originales;
la evidencia de esta integración se registra aparte.

El binario nativo reconstruido tiene SHA-256
`4ba2617c3fc9b6761c750e4cca332bf1b09ab00dd06965d2693e4f3bd02ec3ad`,
idéntico al del paquete anterior de setters. El núcleo conserva por tanto
la evidencia del Memcheck completo; se repite el estrés de entornos y la
instalación del paquete que incorpora los nuevos helpers JavaScript.

El [estrés combinado de memoria](../memory/2026-09-12T20-51-49.868Z-linux-x64.json)
pasó en los cinco modos. rustdom terminó con cero supervivientes de sus 882
documentos y ventanas. Cada modo Vitest observó y liberó 880 documentos y
ventanas, incluidos fallos de inicialización. Se conservaron deliberadamente
constructores de APIs y señales externas para comprobar el cleanup.

Los deltas finales de heap/RSS fueron 2,46/14,65 MiB en rustdom,
3,81/83,47 MiB en Vitest normal y 3,42/39,89 MiB en VM. El nuevo estrés incluye
más escenarios y referencias retenidas; no representa la misma carga que el
estrés anterior. Los logs conservan muestras, contadores y límites de la prueba.

El paquete integrado con SHA-256
`693b877074cd8d0e5699f2d16cb4789712d8ff1d0d3d231612fbb75062ade8f0`
pasó **18 controles** tanto en [Node 24](../distribution/2026-09-12T20-49-13.054Z-linux-x64.json)
como en [Node 22.12](../distribution/2026-09-12T20-49-32.103Z-linux-x64.json).

El [benchmark de la integración](../benchmarks/2026-09-12T20-54-18.309Z-linux-x64.json)
se ejecutó sin otros runners locales. Conserva procesos alternados, muestras
crudas y verificaciones de resultados. El ratio es tiempo jsdom / tiempo rustdom.

| Operación | Filas | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Setup normal | 25 | 11,220 | 17,167 | 0,65× |
| Setup VM | 25 | 8,498 | 8,129 | 1,05× |
| nodeValue, 1.000 escrituras | 250 | 0,357 | 1,621 | 0,22× |
| textContent, 1.000 escrituras | 250 | 5,723 | 10,863 | 0,53× |
| nodeValue, 1.000 escrituras | 1.000 | 0,424 | 1,613 | 0,26× |
| textContent, 1.000 escrituras | 1.000 | 5,336 | 11,428 | 0,47× |

El setup normal y las escrituras siguen teniendo más costo que jsdom en estas
mediciones. El setup VM queda cerca de la paridad. Las diferencias entre dos
ejecuciones históricas no se presentan como causalidad del merge; estos datos
identifican la combinación efectivamente validada y sus límites de rendimiento.
