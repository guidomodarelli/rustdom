# Aislamiento del crate auxiliar

El reloj estaba bajo `benchmarks/native-thread-clock`. La huella canónica
recorre todos los archivos de `benchmarks/`, incluidos outputs ignorados de
Cargo, y el workflow XML también observa ese árbol. Esa ubicación agregaba
entradas ajenas al benchmark de producción y podía incorporar binarios y
artefactos de compilación a la identidad del código fuente.

Se trasladó a `reports/benchmarks/native-class-ownership/thread-clock-addon`,
junto al resto del diagnóstico. `benchmarks/sources.cjs` y los workflows no se
modificaron. El path relativo de `napi` en Cargo.toml se ajustó para resolver
el mismo SDK. El archivo Rust es idéntico al publicado en `4f455da4` y el reloj
reconstruido conserva exactamente SHA-256
`dcf97f05c4a088916a6a391efd32d62663c719a35788540f0396ea014dc4c51d`.

Se ejecutaron fmt, Clippy, test Rust y build reales en la ubicación nueva.
Después se ejecutaron juntos `thread-clock.spec.cjs` y `thread-evidence.spec.cjs`:
Node 22.12.0 aprobó once tests y conservó un skip explícito; Node 24.14.1 aprobó
los doce. Los logs originales están aquí. No se ejecutó otra corrida del
diagnóstico ni se generaron muestras de rendimiento para aceptar el traslado.

`verification.json` conserva la huella canónica antes y después de compilar y
testear, incluyendo los 333 paths y diagnósticos Git. Ambas tienen sourceHash
`8332276799c5ccc18c7a45a5136a856b039736597d5e104e22f074f8e23f1ddd`,
el mismo del runtime de producción ya validado. La compilación auxiliar no
agrega fuentes ni outputs a esa identidad. El denominador del inventario de
migración no se modifica.

`constants/thread-history.json` conserva exactamente el descriptor del método
v1 medido. La revisión operativa v2-layout tiene dieciséis fuentes y rutas
corregidas; el verificador reconoce ambas configuraciones. Los 46 archivos del
archivo v1, sus quince snapshots, timestamps, binario identificado y resultados
permanecen intactos. Los cinco contratos de evidencia siguen recalculándolo y
rechazando las mismas alteraciones. Esto corrige ubicación y trazabilidad,
sin aportar una hipótesis nueva ni volver a aprobar o medir el candidato.
