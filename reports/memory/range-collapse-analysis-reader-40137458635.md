# Recursos del analizador offline

El lector opera sobre JSON y CSV ya guardados; no crea DOM ni importa scripts
extraídos. La decisión viene del verificador congelado sobre el run completo.
La carga de código autentica el recibo y los563 archivos actuales antes de
require, junto con los helpers y el ejecutable Node. El checkout Linux de fuente
permanece limpio y separado de los destinos de análisis.

El exportador procesa un reporte por vez y escribe CSV por filas. Mantiene
contadores, rangos de snapshots, sets de valores escalares y las comparaciones;
no conserva Window/Document ni objetos del addon. Los descriptores de salida
abiertos se cierran en finally. El verificador completo conserva su propia
metodología y sus allocations; no se midieron RSS/heap ni memoria pico de este
proceso. Las pruebas finitas no garantizan ausencia universal de fugas.

La QA de ambos Node fijados comparó 24576 filas históricas con su CSV y los totales
originales, incluidos 24576 Window/24576 Document separados, 6144 warmup, 18432 medidas,
4096 estados finales claros y 264 primeras rondas no claras. Son datos del run
histórico 40113188886 y no se relabelan como resultados del 40137458635. La prueba
con Document retenido y la de baseline nativo alterado impiden una afirmación
falsa de liberación. Los alias no pueden escribir en los inputs ni en la fuente.

Los grupos de recursos separan Node, fase, motor y paquete físico. Sus mínimos y
máximos son snapshots observados; no estiman memoria pico ni causalidad entre
paquetes. Se conservan todos los controles rechazados y regresiones del input.
La captura nueva y su análisis positivo siguen pendientes; no hay aceptación de
rendimiento ni reevaluación de los rechazos históricos.
