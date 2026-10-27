# Recursos del ensayo completo de una copia por proceso

El run 39727878290 completó 128 workers en Node 22.12.0 y 24.14.1, con las
ocho cargas y los paquetes oficiales A0/A1/C/J0/J1. Cada proceso cargó únicamente
su distribución seleccionada. Se conservaron todas las referencias y trazas.

El sampler validó 12.288 referencias de Window y 12.288 de Document de los
fixtures, incluidas las de warmup. Las 3.072 observaciones de limpieza incluyen
88 estados inicialmente no claros. Los 2.048 endpoints finales exigidos quedaron
claros y satisficieron los baselines nativos en los verificadores congelados.
No se descartaron los estados iniciales ni representan 88 objetos distintos.

El método conserva tres rondas de limpieza y exige las últimas dos claras.
Las referencias se acumulan dentro de cada worker, conservando los propietarios
de lotes anteriores como observadores débiles. Los contadores nativos y estados
completos están en los reportes originales del artefacto.

Heap JavaScript, memoria externa y RSS son observaciones después de GC del
proceso completo, no memoria pico ni solo el costo del árbol Rust. Se publican
rangos de todos los estados y de los endpoints finales por separado; no se
transforman en una comparación causal de A/B ni prueban ausencia universal de
fugas. El RSS retenido por el allocator no se interpreta por sí solo como fuga.

La preparación y el archivo completo se verificaron offline en ambos Node,
sin nuevos escenarios DOM o GC. El rechazo del presupuesto corresponde a la
calibración del control jsdom; no a una retención final detectada en estos casos.
Los escenarios de errores de construcción, realms y recursos adicionales
continúan en la validación funcional previa de C, con sus propios límites.

Ver [muestras y trazas completas](../../benchmarks/native-class-ownership/single-package/39727878290/README.md).
