# Validación del método con orden independiente

Las 23 pruebas pasan sin skips en Node 22.12.0 y 24.14.1. Se ejecutaron
`node --test --test-concurrency=1` sobre `single-package.spec.cjs` y
`independent-order.spec.cjs`, con los paquetes reales de la
preparación oficial 39720077911. Los comandos, salidas, reportes y fuentes
están conservados en el archivo de evidencia. No se reconstruyeron paquetes.

El arnés contiene 387 archivos, SHA-256
`6904db29afcddf80aca5e775ec9ebe6d2a680b11891259f3bdcc8b58f4f8ff31`.
La revisión independiente estática y el replay legado terminaron con cero
hallazgos accionables; `review.json` conserva el reporte y todas las huellas.
La revisión remota del PR estaba sin cuota; no se volvió a solicitar para
eludir el límite. La revisión nativa continúa el proveedor ya seleccionado.

Los contratos verifican las dieciséis combinaciones del diseño, las entradas
inválidas, el rechazo de fuentes sin revisión y de archivos con factores o
cleanup alterados. El verificador legado reproduce los 128 workers del ensayo
anterior manteniendo `accepted=false`; el nuevo CLI rechaza reutilizarlos como
si fueran el nuevo diseño. Los contratos negativos preservan el archivo previo.

Se completaron 16 workers reales entre ambos Node y ambos métodos: ocho por
Node, con las ocho cargas públicas en cada proceso y un paquete cargado por
proceso. Son 128 lotes y 1.152 duraciones, con outputs equivalentes. Es una
validación funcional del método: estos workers no constituyen el estudio de
256 procesos ni aceptan su presupuesto. El CLI completo exitoso y su decisión
global siguen pendientes del ensayo publicado.

Actionlint y el preflight extraído del YAML real pasaron. El preflight autentica
ZIP, tar, preparación completa y recibo de revisión, sin ejecutar benchmarks.
Su fixture local usa `d1891dbf` como metadata: ese commit anterior no contiene
el nuevo método y no es aprobación del commit que se publicará. La concordancia
del SHA y las 387 fuentes publicadas debe comprobarse antes de activar la etiqueta.

Los cambios son del método de medición. No se modificaron Rust, las cargas
públicas, sus fixtures, el teardown ni los presupuestos. No se ejecutaron de
nuevo las suites DOM/Jest/Vitest por este incremento de herramientas. El último
CI general completo publicado es `181957b9`; el de `d1891dbf` sigue pendiente.
No hay crédito de migración, merge ni checkpoint de ownership.

[Evidencia cruda y fuentes](../../../benchmarks/native-class-ownership/independent-order-method/README.md).
Para recalcular los contadores sin ejecutar DOM ni tomar nuevas muestras:

```text
python3 verify-validation.py ../../../benchmarks/native-class-ownership/independent-order-method
```
