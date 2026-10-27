# Candidato aislado: limpieza fría de ownership

Esta variante añade `#[cold]` y `#[inline(never)]` únicamente a
`PendingClassValue<T>::drop`, en una copia de fuentes de f44f5dd0. Conserva el
guard, su transferencia al finalizer, los destructores y los casos ZST/alineados.
El Drop del guard se necesita cuando la asignación todavía no fue transferida
(error o unwind); el éxito mantiene `transfer()`. No cambia el destructor normal
de las instancias que JavaScript ya adoptó.

**No está integrada al runtime, no se midió rendimiento y no acepta el gate.**
La producción permanece en el runtime congelado 5ef668c4 y el motor sigue híbrido.
Los dos estudios rechazados y el diagnóstico512 se conservan sin cambios. No se
ejecutó un sampler ni se repitió ninguna secuencia. No hay tag ni merge.

## Motivación y observación estática

Los perfiles nuevos sitúan `produceMutationRecords` entre los callers JavaScript
con más ticks de las operaciones nativas; V8 no expone por eso un stack interno
Rust ni prueba la causa del rechazo. La inspección antigua señalaba un wrapper
tipado adicional, pero el binario actual ya no lo contiene: no se repite ese fix.

Se construyeron base local y variante en la misma ruta, con Rust 1.99.1, lockfile
y flags de release iguales. El único cambio de fuente son los dos atributos del
patch. La conversión `NativeMutationRecord::to_napi_value` ocupa 713 bytes en la
base local y 681 en la variante; se conservan funciones, direcciones, ensamblado,
símbolos completos y ambos binarios. Esto reduce 32 bytes del cuerpo de esa función,
no demuestra menos tiempo ni mejora global. El tamaño total de ambos binarios
también figura en inspection.json, sin seleccionar solo la métrica favorable.

La base local NO es la A histórica del gate. Es el runtime actual con guard,
reconstruido desde f44f5dd0: SHA62e941778ff2974e697087ecbd4c11db5135df9b498ee08522f531442d6d50e2.
La variante es 9bab7909799346eedf30f380b78eb9dcbda085e38bc6eb82df9fda12eb0d1f7e.
Estos binarios locales no se presentan como los usados en la captura512 ni
como artefactos reproducidos byte a byte en otra ruta o máquina.

## Validación ejecutada

- Seis tests existentes del guard por variante, incluyendo error propagado,
  transferencia, ZST ordinario, placeholder y alineación32.
- Los 311 tests Rust del candidato, formato y Clippy con warnings denegados.
- Catorce tests del addon real por variante y Node 22.12.0/24.14.1: constructores
  fallidos, terminación de workers, referencias a constructores y snapshots.
  La regresión nueva fuerza `napi_wrap` fallido de MutationRecord, comprueba una
  creación/liberación por intento y preserva receptor, target y UTF-16 no pareado.
- Memcheck de los seis tests del guard en ambas variantes: cero errores y cero
  bytes definitivamente/indirectamente perdidos. Se conservan 48 bytes posiblemente
  perdidos y 548 alcanzables en ambas; el stack de los 48 pasa por el hilo/contexto
  de libtest/std. No se ocultan ni se concluye ausencia universal de fugas.

Los counts no se suman como compatibilidad o avance: los 311 incluyen los seis
tests del guard. La variante solo se calificó en Linux x64 y en estos contratos;
no se ejecutaron suites completas Jest/Vitest del candidato ni pruebas Windows/
macOS del candidato. Tampoco se midió memoria pico o el costo del camino de error.

## Reproducción y límites

`cold-cleanup.patch` se aplica a un checkout aislado de f44f5dd0; no aplicarlo a
las fuentes de un estudio consumido. Usar Rust 1.99.1 y el Cargo.lock registrado.
Construir base y candidato en la misma ruta, conservando la biblioteca base antes
del patch. Los comandos exactos, versiones, resultados y manifest de 971 archivos de copia de
fuentes están en validation/ y source-copy-plan.json. Los paths absolutos de esos
logs son procedencia de esta máquina; ajustar rutas, conservando las entradas.

Los snapshots `.txt` son evidencia legible de los controladores ejecutados, no
entrypoints portables ni scripts para ejecutar desde un archivo. Reproducir con
los comandos del checkout actual: `cargo build --release --locked`,
`cargo test --release --locked --lib`, `cargo fmt --check` y
`cargo clippy --all-targets --release --locked -- -D warnings`.
`node scripts/build-native.mjs` instala el addon construido en dist/; los tests
funcionales existentes son tests/native-class-construction.spec.cjs,
tests/napi-lifecycle.spec.cjs y tests/native-initialization.spec.cjs. Copiar la
regresión functional/native-mutation-record-construction.spec.cjs a tests/ del
checkout aislado para mantener sus imports relativos de loader/constantes.

El tar conserva solo binarios y el arnés Rust que ya se ejecutaron; es evidencia,
no autorización para ejecutar código archivado automáticamente. Sus hashes y
alcance están en qualification.json. No es evidencia de una mejora de tiempo.

Antes de integrar se necesita calificar compatibilidad completa y medir esta
variante bajo un protocolo nuevo, publicado, probado y revisado, con autorización
independiente para su secuencia. No reutilizar ninguna autorización consumida,
cambiar los presupuestos históricos ni considerar esta inspección una aceptación.
