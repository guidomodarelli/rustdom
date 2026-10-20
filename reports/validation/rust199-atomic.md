# Compatibilidad de AbortSignal con Rust 1.98 y 1.99

Validación local del 20/10/2026, Linux x64/WSL2. Continuación del PR 70 sobre
`016ae916ea31c24ce91a67be48ecef33dce590f2`.

## Problema y cambio

Los jobs iniciales de Ubuntu, Windows y macOS fallaron en Clippy porque Rust
1.99.1 deprecó `AtomicU64::fetch_update`. La validación anterior usó Rust
1.98.1. Los [logs originales](rust199-atomic/initial-ci/) conservan el diagnóstico;
no se desactivó `-D warnings` ni se agregó una excepción a la deprecación.

La reserva de identidades de AbortSignal usa ahora un bucle con
`compare_exchange_weak`, compatible con ambos compiladores. El helper pertenece
al módulo de estado y no depende de N-API; el binding conserva la construcción,
el lock y la gestión del grafo existentes. `Relaxed` sigue siendo suficiente:
el contador garantiza unicidad, sin publicar datos de otro objeto.

Tres regresiones ejercen ocho hilos sincronizados con barrera, 8.000 reservas
únicas y contiguas, agotamiento sin incremento posterior y competencia por la
última identidad exactamente representable en JavaScript. El helper no agrega
allocations, referencias persistentes ni un nuevo owner del grafo.

## Validación ejecutada

| Control | Resultado |
|---|---|
| Clippy, todos los targets, warnings como errores | Pasa en Rust 1.98.1 y 1.99.1 |
| Tests Rust completos | 262/262 por compilador |
| Contratos focales AbortSignal/DOMParser/CharacterData y GC | 314/314 en Node 22.12.0 y 24.14.1 |
| Suite Node completa, addon final | 2.757/2.757 por versión |
| Jest, Vitest, pools VM reales | 20, 31 y 30 por versión |
| Paquete instalado con npm y pnpm fuera del checkout | 20 controles por versión, 40 en total |
| Valgrind, módulo AbortSignal final | 8 tests y un control separado, sin errores |
| Revisión independiente del cambio | Sin hallazgos accionables |

La suite completa y los consumidores instalados utilizan el addon release
construido con Rust 1.99.1. Node 22 usa npm 11.19.0 para la instalación; Node 24
usa npm 11.11.0. Los comandos, salidas crudas y resultados del paquete están
enumerados en [evidence.json](rust199-atomic/evidence.json).

Los corpus HTML5, WPT y el Memcheck de los 259 tests anteriores corresponden
a la [validación del hito DOMParser](dom-parser-undefined.md). No se presentan
como una nueva ejecución local completa de esos corpus tras el ajuste atomic.
Los checks remotos del nuevo SHA deben pasar antes de integrar el PR.

## Identidad de los artefactos

- Fuentes finales, verificadas contra el runtime medido:
  `c5d381f79cb33731357b45c101c9a035e5deceb755a63a9209c9600f86998762`.
- Addon final Rust 1.99.1:
  `f74df0c4abd1229db174218e14c41e1151357da2cb9f58f491e8684b35355849`.
- Paquete instalado por ambos runtimes:
  `ad8c6864c88750c65640f2ba200826af44631f2047f54dafe1c3de9b8458271f`.
- El control reconstruye las fuentes publicadas en `016ae91` con el mismo
  Rust 1.99.1: addon
  `b76c34f96c9c1b9c05411269a7931284164ab35eab35149aec92e111c1083454`.

El digest canónico cubre implementación, harnesses y dependencias bloqueadas;
su alcance exacto está en [source.json](rust199-atomic/source.json). La evidencia
anterior de DOMParser conserva sus propias identidades con Rust 1.98.1.
Los archivos grandes se preservan con gzip sin pérdida y hashes del contenido
original y comprimido.

## Memoria

Valgrind ejecutó los ocho tests del módulo, incluidos los nuevos hilos, y luego
un test anterior aislado con el mismo binario. Ambos procesos conservan
**0 errores, 0 bytes definitivamente perdidos y 0 indirectamente perdidos**.
Los mismos **48 bytes posiblemente perdidos y 548 bytes alcanzables** aparecen
en ambos: los stacks apuntan al canal del harness `test` y a la inicialización
`std::sys::pal::unix::stack_overflow`. Los dos logs completos están preservados.

Las suites reales repitieron los escenarios de GC de AbortSignal, dependencias,
DOMParser, Document y Window por separado. Sus resultados y memoria posterior
a GC están en [reports/memory/rust199-atomic](../memory/rust199-atomic/).
Estas pruebas finitas no demuestran ausencia absoluta de fugas; el RSS no
representa memoria pico ni equivale por sí solo a objetos vivos.

## Rendimiento

Los [benchmarks de AbortSignal](../benchmarks/rust199-atomic/README.md) comparan
operaciones públicas completas con el mismo compilador y preservan todos los
procesos, muestras y controles jsdom. Esta corrección resuelve la compilación;
no se presenta como una optimización. Los costos frente a jsdom y cualquier
variación adversa permanecen visibles en la comparación.
