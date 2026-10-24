# Memoria del ensayo seeded: alcance finito

Los 256 workers completos conservan 24576 observaciones de Window y 24576 de
Document, incluidas 6144 observaciones exteriores de warmup de cada tipo.
Los dos tipos se observan por separado. Todos los lotes cumplen los dos últimos
endpoints claros de las tres rondas fijadas antes de que termine su proceso.
La verificación original y la copia offline recomputan ese contrato.

El código isReleased compara los campos de vida nativos con el baseline del
worker y conserva la reserva acotada de handles. Incluye los contadores expuestos
de rangos, mutaciones, observers, clases N-API y sus errores de cleanup, además
de otros recursos de NativeTreeStatistics. No exige que contadores históricos como
created/released vuelvan a cero. El método no agrega owners persistentes de
Window/Document; los probes RNG y su estado interno de V8 pertenecen al proceso.

El JSON adyacente conserva, por Node y motor, mínimo/mediana/máximo de RSS,
heapTotal, heapUsed, external y arrayBuffers en el último cleanup de cada worker.
También registra el cambio entre el último y el primer lote ya limpiados. Esas
estadísticas mezclan los órdenes balanceados originales y no representan una
serie temporal de un único objeto ni memoria pico. RSS o memoria externa retenida
no identifican por sí solos una fuga ni obligan al allocator a devolver páginas.

Las muestras por lote, baselines y trazas completas están en el tar del ensayo,
SHA-256 39299c4ae809e5a4386a9963f2c35dde657e188404012ed46c8824c26be5a10f.
analyze.py permite regenerar el JSON desde ese mismo archivo extraído.

Este resultado cubre las ocho cargas públicas normales y sus cierres; no amplía
la cobertura de errores de construcción ni acredita ausencia absoluta de fugas.
Las pruebas previas de constructores interrumpidos y el CI general mantienen
su evidencia separada. El presupuesto de rendimiento sigue rechazado por cuatro
controles jsdom y no se redefine usando estos endpoints.
