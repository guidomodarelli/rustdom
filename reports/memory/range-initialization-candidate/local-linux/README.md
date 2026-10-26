# Recursos del candidato de inicialización

Los archivos `node22.json` y `node24.json` son las salidas crudas de
`tests/helpers/range-state-memory.cjs` con el addon real del candidato
`e313770b9a16edba40757b62b2384ce8b39afb26f4848b2b1feba637a73513d6`.
Se conservaron las tres etapas de cada ciclo y los controles de retención
del binding; no se completaron muestras faltantes ni se repitió una captura.

En ambos SDK pasaron seis ciclos con Range vivo, StaticRange retenido después
del cierre y liberación final. NativeRange terminó con 4814 creados, 4814 liberados
y cero vivos. Las observaciones de Document y Window son independientes.
`suite-reports/` conserva además todos los informes de recursos producidos por
la suite de compatibilidad de esta build.

Los snapshots de heap, memoria externa y RSS no son mediciones de pico.
La finalización observada en estos escenarios no demuestra ausencia universal
de fugas. No se evaluó el presupuesto de rendimiento del candidato.
