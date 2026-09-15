# FormData: errores del protocolo y conversiones observables

Se corrigieron los hallazgos 4020396451 y 4020396455 sobre la base 7d3c5b3.
Rust valida los slots del método iterador y next antes de invocarlos. Las rutas
inválidas generan el TypeError del motor con vistas inertes de valores ya leídos,
sin volver a ejecutar getters o métodos del iterador real. Se conserva la
precedencia del error original durante IteratorClose.

La comparación también encontró que webidl-conversions observa
StringCtor(value).toWellFormed(). Se conserva esa secuencia y sus efectos,
incluidos throws y cierre del iterador; no se sustituye por una coerción nativa
que omita los hooks. Esta conversión se distingue de los diagnósticos de
iteración, que deben usar intrínsecos y no el global TypeError mutable.
El constructor y la iteración permanecen controlados por Rust; no se delegan
a jsdom. capture_pending_error mantiene su implementación y ownership.

## Evidencia

- La matriz ampliada compara 608 casos por cada una de 16 variantes: cero
  diferencias frente a jsdom 27.4.0. Incluye default/VM, controles/options,
  iterable nulo, slots no invocables, funciones/clases/proxies, retornos
  primitivos, getters, String alterado y cierres internos/externos.
- Pasaron formato, Clippy y tests Rust, 34 contratos focales y npm test completo
  en Node 22.12.0 y 24.20.0: 2.160 Node, Jest 18, Vitest 29 y VM 30 por versión.
- La prueba de GC pasó sus seis ciclos por runtime, observando listas nativas,
  iteradores, errores, propietarios, Window y Document. Los logs y cuatro JSON
  de memoria conservan las observaciones y límites; son pruebas finitas,
  no una demostración de ausencia universal de fugas.
- Addon usado: 05af98ba35151c1afcf235af3f4effe37edd6a996079671542009da7d160054b.
  Lockfile y versiones quedan registrados en los reportes del benchmark.

Los reportes baseline, candidate y extended-* de este directorio conservan
todos los casos y diferencias. Los fallos de preparación de fixtures están
separados y no se presentan como resultados del gate final.

## Rendimiento

Los benchmarks están en reports/benchmarks/formdata-iterator-errors/:
2026-09-15T22-27-23.775Z-v24.20.0.json y
2026-09-15T22-27-28.381Z-v22.12.0.json. Se conservaron muestras, rangos,
versiones, identidades y metodología.

Las medianas brutas aumentaron aproximadamente 7,0%/8,6% en factory-result,
2,4%/2,2% en next-result y 9,5%/8,7% en construcción válida (Node24/Node22).
Se registra el costo de compatibilidad; no se afirma una mejora de rendimiento
ni se extrapolan estas mediciones a otras cargas.

La unión con XML y su paquete final requieren validación del coordinador.

## Archivo de matrices históricas

Los JSON históricos mayores que 256 KiB se conservan como .json.gz sin pérdida.
archive-manifest.json relaciona las rutas originales con los archivos, tamaños
y SHA-256; cada descompresión se comprobó byte por byte. Los logs originales
mantienen sus rutas de salida. Para usar herramientas que esperan .json,
descomprimir cada archivo en su ruta original; no se descartaron casos.
