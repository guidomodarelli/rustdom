# Recursos de las tres matrices funcionales

Head `2a53f88c9c272d2753f6ef052132bbb72ada62ee`, intento 1.
Los 18 artefactos originales y sus hashes API están en
`reports/validation/node-windows-shutdown/hosted-2a53/confirmed/`.
El lector mantenido allí verifica los endpoints desde los ZIP como datos.

`endpoints.json` conserva 216 estados finales: seis ciclos por cada uno de dos
probes en cada job. Cada endpoint observó `Window` y `Document` por separado,
supervivientes cero, árbol y rangos nativos vivos cero y dos estados claros
consecutivos. Se conservan contadores N-API, capacidades del allocator y snapshots
de heap, memoria externa y RSS; no se descartan resultados menos favorables.
Los ZIP conservan también estados retenidos, trazas, baselines y logs completos.

Son pruebas finitas de escenarios funcionales. Los snapshots no miden memoria
pico, no distinguen por sí solos toda retención del allocator y no demuestran
ausencia universal de fugas. No se reemplazan los estudios de rendimiento
rechazados ni se acepta ownership. No cambió el runtime híbrido de producción.
