# Recursos durante la validación del contexto completo

Los contratos Node22/24 ejercitaron ocho workers jsdom reales: cuatro con las
ocho filas y cuatro con el alcance aislado previo. Sus 72 lotes comprobaron
864 WeakRef de Window y 864 de Document, incluyendo warmups. Se recalcularon
288 comprobaciones finales por etiqueta, con dos endpoints finales claros por lote.

La ampliación mantiene las tres rondas de limpieza y el timeout finito del
worker. Los Maps nuevos contienen únicamente checksums por fila y quedan
acotados a ocho entradas; las listas de observación guardan WeakRef. No se
introdujeron referencias fuertes al DOM ni se cambió el runtime de producción.

No se cargó el addon Rust. Son endpoints posteriores a GC, no memoria pico ni
una garantía universal de ausencia de fugas. El diagnóstico prospectivo de
ocho procesos/1.152 duraciones todavía no se ejecutó.

Datos, fuentes y resultados:
[runner-sharing-context](../../validation/native-class-ownership/runner-sharing-context/README.md).
