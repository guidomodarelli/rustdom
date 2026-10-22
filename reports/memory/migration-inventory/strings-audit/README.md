# Recursos del generador de inventario

Se ejecutaron tres ciclos reales por Node 22.12.0 y 24.14.1. El helper conserva
tres reportes escalares completos mientras observa Window y Document por separado
mediante WeakRef y GC explícito. Los dos endpoints finales exigidos quedaron
claros en ambos Node; las trazas completas están en los stdout, incluidos los
estados intermedios. Se observaron seis Window y seis Document en total.

La auditoría agrega solamente rutas y clasificaciones escalares. No modifica
los algoritmos DOM, el addon ni ownership. Esta comprobación cubre la retención
del generador con sus reportes vivos; no cubre toda la plataforma ni demuestra
ausencia universal de fugas. El contrato público HTML adicional cierra sus
ventanas, pero no se usa como prueba de que fueron recolectadas.

Heap, memoria externa y RSS son observaciones posteriores a GC, no memoria pico.
El RSS máximo del comando completo de inventario se conserva separadamente en
sus benchmarks y no se interpreta como retención del allocator o fuga nativa.
