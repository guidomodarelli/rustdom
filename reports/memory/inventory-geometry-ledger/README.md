# Liberación al conservar reportes del inventario

Los JSON Node22.12.0 y24.14.1 registran tres ciclos por versión del helper real:
captura la superficie con jsdom27.4.0, cierra el entorno, conserva los tres
reportes escalares y observa Window/Document mediante WeakRef por separado.
El endpoint requiere dos muestras claras en turnos distintos después de GC.
Ambos terminan con cero supervivientes y released=true; se conservan heap,
memoria externa y RSS de cada ronda observada.

El mismo contrato integrado pasa también en Windows22.12.0/24.22.1. Esto
comprueba que estos reportes no retienen los owners en los escenarios finitos
ejecutados; no prueba ausencia absoluta de fugas ni memoria pico. No se carga
el addon Rust en esta auditoría de tooling. La evidencia nativa histórica de
DOMRect y sus límites siguen en geometry-audit.md y no se presentan como una
medición nueva. No se introdujeron caches o registros persistentes del DOM.
