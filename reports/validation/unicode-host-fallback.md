# Perfil Unicode efectivo cuando no hay tablas incluidas

Corrección del hallazgo `3994645927` del PR #8, inicialmente revisado sobre
`0f40cc06e7f25cac80d3b656e48528f1eaa43fba`.

## Comportamiento

El runtime ya no aborta su inicialización porque `process.versions.unicode`
contenga un identificador desconocido o esté ausente. Las versiones incluidas
siguen usando sus tablas fijadas. Para las demás se recorren una vez los
1.112.064 escalares Unicode válidos, usando `String.fromCodePoint` y
`String.prototype.toLowerCase` de un contexto VM nuevo con las intrínsecas
reales del mismo host. Los surrogates aislados no son escalares y se excluyen.

El resultado se copia a un `Uint32Array` del contexto llamador; el contexto
temporal queda sin referencias desde la cache. La cache del módulo contiene
una sola tabla del host, sin usar identificadores arbitrarios como claves.
Cada bosque nativo recibe una copia mediante un `ArrayBuffer` no compartido.
Rust comprueba longitud, rango escalar, orden estricto y ausencia de duplicados
antes de reemplazar el perfil por un `Box<[u32]>`. El adaptador N-API rechaza
buffers desconectados y tipos incompatibles, incluyendo `SharedArrayBuffer`.
La marca `ArrayBuffer` se verifica explícitamente con Node-API antes del cast:
la prueba detectó que la conversión automática de `napi-rs` por sí sola no
rechazaba `SharedArrayBuffer` en este host. El único bloque `unsafe` del cambio
convierte ese valor después de comprobar su marca nativa, sin ejecutar JS entre
la comprobación y la conversión.

El filtrado DOM posterior hace búsqueda binaria en Rust. No invoca JavaScript
por nombre ni usa silenciosamente las tablas de otra versión. El código JS de
esta ruta obtiene datos de ICU; los algoritmos de colección y filtrado quedan
en Rust. El rango `engines` del paquete conserva su alcance.

## Ownership y límites

- Una tabla JS por instancia del módulo, compartida únicamente por inicializaciones.
- Una copia propia por bosque nativo; reemplazar el perfil destruye la copia anterior.
- Ninguna referencia a nodos, documentos, ventanas, arenas o callbacks desde la cache.
- Cada payload numérico tiene como máximo 1.112.064 entradas de cuatro bytes:
  4.448.256 bytes por copia. El tamaño real del host se registra en el benchmark.
- Las asignaciones transitorias del recorrido y del contexto VM agregan costo de
  arranque. La medición del payload no equivale a RSS ni memoria pico del proceso.

## Validación reproducible

```sh
cargo test --locked --lib
cargo clippy --locked --all-targets -- -D warnings
npm run build
node --test tests/unicode-host.spec.cjs tests/attribute-collections.spec.cjs
node benchmarks/unicode-host.cjs
```

Las pruebas del proceso hijo fuerzan un identificador no incluido y su ausencia,
conservando las tablas reales del host. Cargan `rustdom`, crean documentos,
comparan enumeración, propiedades propias, lookup y serialización con jsdom
27.4.0 independiente. Cada modo observa 48 referencias débiles a ventanas y
documentos, en doce ciclos por motor, después de `close()` y GC mayor.

Las pruebas nativas conservan los perfiles 15.1/16/17 y verifican que una
transferencia inválida o una versión no incluida dejan intacto el perfil previo.
El test N-API también muta el buffer original después de instalarlo para
comprobar la copia propia y ejerce SharedArrayBuffer y buffers desconectados.

Estas pruebas no simulan ni certifican las tablas de una versión Unicode futura:
solo fuerzan la selección alternativa y comprueban su equivalencia con el host
real. Tampoco constituyen una prueba absoluta de ausencia de fugas.

### Resultados ejecutados antes del rebase

- Rust: 24 tests aprobados; formato, Clippy y build release aprobados.
- Declaraciones públicas: `tsc --noEmit --strict --target ES2022 --module NodeNext
  --moduleResolution NodeNext types/native.d.cts`, aprobado.
- Node 22.12.0: 8/8 tests aprobados, con los perfiles reales Unicode 16.0/ICU 76.1.
- Node 24.14.1: 8/8 tests aprobados, con los perfiles reales Unicode 17.0/ICU 78.2.
- Cada modo desconocido/ausente observó 48 referencias y cero sobrevivientes;
  `liveNodes` y `dataNodes` terminaron en cero en los cuatro procesos.

Registros completos:
[`unicode-host-node22.log`](../memory/unicode-host-node22.log) y
[`unicode-host-node24.log`](../memory/unicode-host-node24.log).

Se conserva el primer intento de Node 22 en
[`unicode-host-node22-io-timeout.log`](../memory/unicode-host-node22-io-timeout.log):
7/8 tests pasaron y el segundo worker agotó el watchdog de 120 segundos mientras
se observaba espera de I/O en `/mnt/c`. El primer worker había completado sus
aserciones en 106,6 segundos. Se amplió únicamente el watchdog del proceso de
tests a 300 segundos; la repetición pasó sin cambiar las aserciones de producto
ni de GC. Ese watchdog incluye carga de dependencias e I/O y no es un objetivo
de latencia del producto.

## Medición ejecutada

El benchmark se ejecutó en una franja exclusiva, con builds/tests de los otros
agentes pausados. Node 24.14.1, Unicode 17.0, ICU 78.2, Linux x64 sobre WSL:

| Operación | Mediana |
| --- | ---: |
| Selección de tablas incluidas | 0,0010 ms |
| Extracción del host e instalación inicial | 147,4238 ms |
| Reutilización e instalación nativa | 0,0021 ms |

Cinco procesos nuevos, diez instalaciones incluidas y diez reutilizadas en cada
uno. El host produjo 1.488 escalares, equivalentes a 5.952 bytes por copia del
payload. Las comprobaciones de filtrado están fuera del timing. La carga del
addon y la creación de nodos están excluidas; estos números no representan la
duración completa de una suite Jest/Vitest.

Muestras crudas, hardware y fingerprints:
[`2026-09-12T02-22-23.362Z-linux-x64-unicode-host.json`](../benchmarks/2026-09-12T02-22-23.362Z-linux-x64-unicode-host.json).

## Integración concurrente y distribución

Se integraron por rebase los cambios de activación de metadata y operaciones
hasta `36642afd25193e567c5b9c2e5a1dbc2346a976d9`. Se clasificó el drift como
relacionado porque afecta `TreeStore`, consultas y serialización. No hubo
conflictos ni cambios en los módulos propios del perfil Unicode. La unión pasó:

- `cargo fmt -- --check` y 29 tests Rust.
- Un build release nuevo del addon y del runtime.
- 44 tests Node 24: Unicode, colecciones, activación de metadata y operaciones.

Los logs están en
[`unicode-host-after-rebase-rust.log`](unicode-host-after-rebase-rust.log) y
[`unicode-host-after-rebase-node24.log`](unicode-host-after-rebase-node24.log).
Se conserva la matriz Node 22 previa para la superficie Unicode sin cambios.
Clippy y el typecheck previos también se conservan; no se afirma que se hayan
repetido sobre el rebase. El benchmark mide los módulos Unicode sin cambios,
con el fingerprint del binario utilizado antes de integrar los otros fixes.

La allowlist de `scripts/package.mjs` incluye `host-unicode.cjs`.
`scripts/package-check.mjs` ahora ejecuta `tests/distribution/unicode-host.cjs`
contra las instalaciones reales de npm y pnpm. Para este fix se ejecutó además
un consumidor focal del tgz fuera del checkout, instalado con npm en `/tmp`:

- Instalación real: aprobada.
- Node 24.14.1 con identificador desconocido y tablas reales Unicode 17: aprobado.
- Node 22.12.0 con identificador desconocido y tablas reales Unicode 16: aprobado.
- Comparación de nombres, propiedades y HTML contra jsdom independiente: aprobada.
- Consumidor temporal eliminado después de verificar su ruta y marker.

SHA-256 del tgz probado:
`7f868d757a559805a90a20af8b0a29d9a014eb4dec46c4029f12441a4c8acb6f`.
Evidencia:
[`unicode-host-focal.json`](../distribution/unicode-host-focal.json).
La matriz completa npm/pnpm de este nuevo gate queda para CI; no se declara
ejecutada localmente en este fix.
