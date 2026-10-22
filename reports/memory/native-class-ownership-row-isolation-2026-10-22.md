# Memoria del estudio completo de aislamiento por carga

Se observaron por separado 24576 Window y 24576 Document, incluidas 6144
observaciones exteriores de warmup de cada tipo. Los 2048 workers completaron
sus tres rondas de limpieza y cumplieron los dos últimos endpoints claros
antes de terminar. La verificación original y la de una copia comprobaron ese
contrato, junto con los baselines nativos correspondientes.

El JSON adyacente conserva 32 grupos por Node, motor y carga: mínimo, mediana y
máximo de RSS, heapTotal, heapUsed, external y arrayBuffers del último cleanup.
Cada worker tiene un solo lote; no se calcula una falsa tendencia entre lotes
de un mismo proceso ni se comparan procesos distintos como una serie temporal.
Los contadores nativos históricos no tienen que volver a cero: se verifican los
campos de vida y la reserva acotada conforme a `isReleased` del arnés congelado.

Los informes, baselines, endpoints y muestras completos están en el tar con SHA
a0643d2c1ff7431f0aea1200e66b2a8bd51a9b4059a51e382b2daf277d0e981c,
publicado en ocho partes verificables bajo
`reports/benchmarks/native-class-ownership/row-isolation-results/2026-10-22/`.
El transporte y verificador offline no cargan el addon ni crean Window/Document;
sus contratos comprueban además limpieza de temporales y conservación de inputs.

Este resultado cubre las ocho cargas públicas normales y sus cierres. No mide
memoria pico, garantías de devolución del allocator, todos los errores de
construcción ni ausencia absoluta de fugas. Las pruebas de construcción
interrumpida mantienen su evidencia separada. Ningún endpoint de memoria
redefine el rechazo de rendimiento por siete controles jsdom.
