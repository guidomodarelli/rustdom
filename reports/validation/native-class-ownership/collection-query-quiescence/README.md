# Espera funcional de colecciones después de doce observaciones

El job Windows `119606475975` del run `39712379896`, SHA `bfe51fef`, falló
en collection-query-memory con Node 24.22.0. Se autenticó el ZIP oficial
`12398056103` con SHA-256 `2a4b9393f4d90cb549f92153a3bc4a4dc52ac1c1a0e21259265daef4cb3825e5`.
Se conservan metadata oficial, log completo comprimido y el JSON fallido original.
El ZIP completo queda en cache local; no se vuelve a publicar sus 233 MB.

El caso jsdom/VM/cycle0 conservaba un Window, Document y root en rondas 1–11;
en la 12 todos los grupos quedaron vacíos, a 326,77 ms. La espera agotó doce
rondas sin alcanzar las dos observaciones claras exigidas. No llegó al deadline
de diez segundos. Esto prueba una observación final clara, no dos, ni la causa
interna de la retención temporal de jsdom/V8.

Se aplica una política propia a las observaciones funcionales de colecciones:
hasta 64 rondas, manteniendo el deadline canónico, dos observaciones claras y
los mismos baselines nativos exactos. Los fallos siguen siendo acotados.
No cambia el runtime, scripts/memory-endpoint ni los samplers de rendimiento.

La regresión usa colecciones reales en default/VM: mantiene un único propietario
fuerte durante doce observaciones, exige al menos catorce para liberar y confirmar,
rechaza propietarios persistentes con ambas políticas y luego exige su liberación.
Cinco tests relevantes pasaron en cada Linux Node 22.12.0/24.14.1 con jsdom y
el addon C real; incluye los escenarios completos originales y el helper general.
Cada Node completó 52 escenarios originales y 60 endpoints exitosos, con 120
observaciones claras finales exigidas. Los JSON originales y logs están aquí.

Windows Node 24.22.0 ejecutó además default/VM de jsdom con la regresión nueva:
14 rondas para liberar, 64 rondas con retención rechazada y liberación posterior
en ambos realms. Se guardan el reporte íntegro, comando y stderr.
La validación nativa completa de Windows queda pendiente del CI posterior al push.
No afirmar que el CI está resuelto hasta observar ese resultado.

`processes.json` fija los archivos probados. La copia de validación usa dist de C
por symlink y las dependencias reales; no recompila ni modifica su root congelado.
Son escenarios finitos con muestras posteriores a GC, sin medir memoria pico
ni probar ausencia universal de fugas. No se produjo un benchmark nuevo.

Revisión nativa local del código: `/root/review_name_queries`, 0 hallazgos
accionables; no ejecutó suites ni confirmó el CI Windows.
