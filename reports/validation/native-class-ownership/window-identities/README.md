# Observación de identidades de funciones

La tanda final ejecutó cuatro probes sin temporizadores: J0/J1 oficiales
con Node22.12.0 y24.14.1, doce Windows por proceso, 48 Windows en total.
En cada proceso JSDOM y Object tuvieron una identidad; Range, cloneRange,
collapse, compareBoundaryPoints, createRange y el getter startOffset tuvieron
doce identidades. Object coincidió con el intrinsic del host en todos ellos.
Se validaron texto público, clon, colapso y comparación de límites reales.

Las tres rondas por Window conservan sus estados; los dos endpoints finales
exigidos están claros para Window y Document por separado. La observación
usa WeakMap para funciones, IDs escalares y WeakRefs de owners. No determina
heap retenido, RSS, memoria pico o ausencia universal de fugas.

Dos invocaciones reales sin --expose-gc fueron rechazadas con exit1 y el
mensaje esperado, una por Node. Se autenticaron las 387 fuentes originales
del arnés y la preparación completa fue idéntica antes/después de cada Node.
No se reconstruyeron addons, reinstalaron dependencias o modificaron paquetes.
El runtime es jsdom27.4.0; no es Rustdom ni una prueba de su rendimiento.

El archivo `observations-and-source.tar.gz` conserva todos los crudos, las
fuentes, el controlador y la capacidad V8 reportada por ambos Node. Incluye
además las dos observaciones preliminares J0 de 24 Windows y su fuente,
separadas de la tanda final. `raw-files.json` autentica cada archivo; el
readback del tar comprobó todos los bytes. `summary.json` es copia del final.

No se han registrado optimizaciones o deoptimizaciones en estos probes. Los
IDs distintos no implican necesariamente código compilado distinto. La
receta siguiente está en `window-identities/OPTIMIZATION-PROTOCOL.md` del
informe de benchmarks: cuatro procesos jsdom originales con trace-opt y
trace-deopt, sin modificar el sampler ni repetir la captura nativa fallida.
Todavía falta fijar, probar, revisar y publicar su launcher antes de ejecutar.

Estas observaciones no aceptan rendimiento ni cambian los rechazos previos,
las muestras, umbrales o crédito de migración. Ownership sigue abierto.
Raíz local: `/tmp/rustdom-window-identities-qualified-ha9snove`, terminal.
