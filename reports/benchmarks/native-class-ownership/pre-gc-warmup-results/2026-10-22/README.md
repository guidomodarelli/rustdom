# GC antes del warmup: resultado completo rechazado

La única secuencia iniciada desde el método publicado en `a558e472` terminó.
Ambos drivers Node finalizaron con exit1; los 256 workers terminaron completos.
La verificación del conjunto terminó con exit0: `verified=true`, `accepted=false`.
Esto confirma integridad, no aceptación de rendimiento.

Se conservan las ocho cargas, fases AA/AB, 16 posiciones, los presupuestos
originales de ±2% para jsdom, ±5% Rust AA y +5% Rust AB, tres warmups exteriores
y nueve muestras. Las mismas colecciones forzadas preceden las tres rondas de
warmup en la ventana actual. No se modificó el método después de observar datos.

Node 22.12.0 rechaza cuatro controles jsdom y Node 24.14.1 rechaza siete.
Ningún punto Rust excede su presupuesto numérico, pero los controles no
calibrados impiden aceptar el conjunto. No hay una mejora de rendimiento
demostrada, causa de variación establecida, autorización de merge o crédito de
migración. El método anterior y la captura de optimización no se repitieron.

`study.tar.gz` contiene los 1992 archivos originales: fuentes congeladas,
publicación, procedencia, índices, resultados crudos, logs, comandos, PIDs,
tiempos de inicio/final y verificación. `raw-files.json` y `receipt.json`
permiten comprobar cada archivo y el archivo comprimido; se leyó de vuelta
íntegramente. El arnés conserva 403 fuentes con SHA-256
`8798e3f0420e7bf78fe6dc9051bc4bda787fe2ccf047cc5a12a97b9381ad3543`.
Hardware, afinidad, entradas, versiones, hashes de distribuciones, configuración
y muestras están en los índices y workers originales del archivo.

Los 2048 lotes preservan sus observaciones de heap, memoria externa y RSS.
Se observaron por separado 24576 Windows y 24576 Documents, incluidos 6144
warmups exteriores por tipo. Los endpoints finales registrados están claros,
con cero supervivientes Window/Document; los contadores Rust se conservan para
inspección. Esta evidencia es finita y no prueba ausencia absoluta de fugas ni
equivale a medir memoria pico. El estudio no cambia producción Rust.
