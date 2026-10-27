# Inventario probado contra Range integrado

El job 122078362952 del CI 5caa3ea9 falló al exigir que `native-tree.cjs`
actual fuera byte-idéntico al de la propuesta de inventario a89ce898. El
archivo cambió al integrar Range. La propuesta, sus recibos y su ledger se
conservan intactos.

El verificador nuevo autentica los dos recibos originales, sus seis y ocho
entradas y todos los archivos auditados. Solo permite la transición exacta
del bridge `dff54af7` a `8bba7c98`, calificada en 5caa3ea9, y además exige que
coincidan los 344 inputs del candidato integrado. Cualquier otro cambio de
bridge, algoritmo, recibo o candidato se rechaza. Registra ambos hashes y
`historicalBytesEqual=false`; no equipara fuentes distintas ni concede crédito
de migración. El workflow continúa construyendo y probando HEAD actual.

Pasaron en Node 22.12.0 y 24.14.1:

- Ocho contratos del verificador con archivos reales y copias alteradas.
- 279 tests de inventario y DOMTokenList/DOMStringMap públicos y nativos.
- Regeneración de los cinco archivos del catálogo, con las exclusiones de
  globals ECMAScript verificadas contra el realm real por el contrato existente.
- Los helpers reales de memoria de tokens y dataset. Los cuatro reportes
  completos están en `reports/memory/inventory-current-runtime/20261027/`.

El SUT local procede del checkout Linux real 7aeb2075 con los cuatro archivos
del candidato aplicados, igual que la calificación publicada de Range. Se usa
el addon a6a21c3c ya construido; no se reconstruyó un paquete consumido ni se
atribuyó a ese checkout otro SHA. La propuesta a89ce898 aporta herramientas,
tests y catálogo. El primer staging omitió evidencia de auditoría: sus cuatro
fallos quedan conservados; tras hidratar los archivos Git reales, la
calificación completa pasó. No se modificó el catálogo versionado.

Los 52 archivos crudos de calificación, incluidos los cinco catálogos de ambos
SDK, están íntegros en `qualification.tar.gz`: 634.983 bytes, 18.941.160 bytes
sin comprimir. `qualification-members.json` conserva sus tamaños y hashes;
todos los miembros se releyeron. No ejecutar fuentes desde el archivo.
También se conserva un probe de metadata con un error de sintaxis previo a
su lectura corregida; el proof final contrasta los 344 inputs del SUT real.

Actionlint validó los cuatro workflows cambiados. El nuevo job Range había
fallado porque el perfil mínimo del toolchain no instalaba rustfmt: se
declaran explícitamente `rustfmt` y `clippy`. Rust y sus 313 tests ya estaban
validados en la evidencia de Range; no se cambió código Rust en este ajuste.

No se activó ni repitió un estudio científico. No se infiere memoria pico,
ausencia universal de fugas ni porcentaje de migración. Los gates de ownership
y XML conservan la incompatibilidad con las fuentes de sus evidencias
anteriores; falta evidencia de rendimiento que corresponda al candidato nuevo.
