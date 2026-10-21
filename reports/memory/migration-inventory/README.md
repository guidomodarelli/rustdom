# Liberación de propietarios al generar el catálogo

En Linux y Windows nativo, con Node 22.12.0 y 24.14.1, se ejecutaron tres ciclos
de observación de una ventana/documento jsdom real, cierre y conservación del
reporte completo. Window y Document se observaron mediante WeakRef por separado.
Después se exigió un endpoint acotado de GC con dos muestras claras consecutivas.

Los cuatro reportes `memory-*.json` contienen trazas de heap, memoria externa,
RSS y supervivientes. Cada ejecución conservó tres reportes y terminó con cero
ventanas y cero documentos observados. El helper real es
`tests/helpers/inventory-memory.cjs`; usa `--expose-gc`.

El catálogo devuelve únicamente datos JSON y etiquetas escalares. Los owners,
descriptores con funciones y mapas de identidad quedan dentro del scope de
observación; se usa WeakMap para las identidades. `close()` también se ejecuta
si falla la enumeración. Los ASTs de TypeScript no se devuelven: solo se guardan
nombres y posiciones; sus enlaces parentales no forman parte del reporte.

Esta prueba no usa Rust ni N-API y no valida cambios del motor. Conservar reportes
retiene intencionalmente sus datos; no se exige que desaparezcan. La prueba
observa liberación de los propietarios DOM en tres ciclos, no una cota universal
de heap, una tendencia ilimitada del compilador o ausencia absoluta de fugas.
El pico RSS del proceso del CLI se mide por separado en los benchmarks.
