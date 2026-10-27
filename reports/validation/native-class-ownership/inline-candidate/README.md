# Validación funcional del candidato C

Sobre el parent publicado 767aca43, C agrega únicamente #[inline] al helper
genérico new_instance<T>. No cambia el guard ni los caminos de error/finalizer.
La compilación aislada Linux/WSL no tiene Git: build-inputs.json conserva sus
960 entradas originales y hashes, verificados sin cambios después de las suites.
native-inline.patch conserva la intervención. El addon tiene SHA-256
afbf5e85e85b542d6324b9a8ce2e0295181ac1896494025dc7834ae1b4c3482f.

Rust 1.99.1 aprobó 311 tests, seis pruebas del guard, fmt y clippy. Memcheck sobre
esas seis pruebas terminó con cero errores, cero bytes definite/indirect,
48 possible y 548 reachable del harness/std: no es una auditoría universal.
La inspección de código emitido conserva ToNapiValue de MutationRecord de 713
bytes y sin el wrapper tipado separado. No demuestra mejora temporal.

Por Node 22.12.0 y 24.14.1 aprobaron 3.751 contratos DOM, Jest 22, Vitest 33,
VM threads/forks 34, entrypoint/validación 16, benchmark harness 122 y cinco
modos de memoria. HTML5: 1.784 casos comparables y ocho script-on excluidos.
WPT: 240 fixtures, 83.007 resultados y 1.203 fallos de estándares compartidos;
la paridad aprobó, no implica cumplimiento completo de estándares. Se conservan
los reportes completos y los límites temporales explícitos para ambos motores.

El paquete real construido aprobó veinte gates npm/pnpm por Node, con consumers
CommonJS, ESM/VM, tipos, assets workers, Unicode, árbol, Jest y Vitest. Los
reportes y lockfiles de ambos gestores quedan íntegros. La reconstrucción final
conservó el mismo addon, los 560 JavaScript y package.json idénticos a B.

La primera validación Node22 falló en dos casos por archivos de auditoría que
faltaban en la copia aislada. El log negativo permanece; se copiaron las mismas
entradas del checkout y los dieciséis casos aprobaron en el log complete.
No se cambió el producto para ocultar ese fallo.

validation.json relaciona cada fuente original con bytes/SHA del contenido y
del gzip almacenado. verify.cjs recalcula esos hashes y la paridad WPT con el
comparador real, gates de paquete y endpoints Document/Window en ambos Nodes.
Ejecutar desde este checkout: node reports/validation/native-class-ownership/inline-candidate/verify.cjs

Alcance: Linux/WSL x64, pruebas finitas. Los endpoints posteriores a GC no miden
picos ni prueban ausencia absoluta de fugas. El estudio de aceptación del nuevo
candidato aún no se ejecutó; no hay presupuesto aprobado ni tag/merge. El CI
verde de 767aca43 corresponde al parent y no valida este nuevo addon C.
