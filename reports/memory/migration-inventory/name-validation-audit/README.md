# Recursos del generador tras la auditoría de nombres

El helper real ejecutó tres ciclos en cada Node 22.12.0/24.14.1 y conservó tres
reportes escalares completos mientras observaba Window y Document por separado
con WeakRef y GC explícito. Los logs registran seis Window y seis Document en
total; las dos rondas finales exigidas están claras y sin supervivientes en
ambos Node. Las once pruebas del inventario también ejercen este contrato,
sin usar sus ejecuciones adicionales para ampliar los contadores de los logs.

La auditoría agrega rutas y clasificaciones escalares, sin cambiar ownership,
algoritmos DOM o addon. La prueba pública nueva cierra dos ventanas por motor,
pero ese cierre no se presenta como demostración de su recolección. Las trazas
guardadas comprueban la retención del generador con sus reportes vivos, no toda
la plataforma ni ausencia universal de fugas.

Los stdout contienen heap, memoria externa y RSS tras GC, no picos. El máximo
RSS del comando completo se registra aparte en sus benchmarks; no se interpreta
como fuga nativa ni retención del allocator.
