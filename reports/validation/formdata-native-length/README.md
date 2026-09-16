# FormData: longitud de IDs sin constructor global

Hallazgo PR67 `4021434610`, baseline `30bad7e5b8f72b112a0e30795f07e8cfd98da5c0`, base main `ece7d46c9cdb94eea3c23e517b341771ee9719d4`.

El cambio de producción agrega `NativeFormDataEntries.idArrayLength(Float64Array)` y sustituye únicamente la captura JS de longitud. El helper obtiene en O(1) la metadata nativa del argumento; no consulta constructores, prototipos, propiedades ni iteradores JavaScript. No agrega referencias persistentes ni cambia ids/allIds. Tipos actualizados; form_data_construct.rs, XML y loader permanecen intactos.

## Reproducción equivalente

Se conserva el fallo frío compartido cuando Float64Array es undefined/null: ambos motores fallan antes en webidl-conversions. No se presenta como una divergencia del adapter. Precargando sólo esa dependencia en ambos procesos, jsdom completa las operaciones y la baseline rustdom falla al leer prototype durante FormData init. Con un constructor reemplazado o proxy de prototype, jsdom también funciona en frío y rustdom dispara la nueva dependencia. Los JSON baseline guardan errores, stacks y contadores completos.

La matriz final compara cold/preloaded, default/VM y cinco mutaciones; conserva los fallos compartidos del oracle en lugar de exigir éxito artificial. Los casos exitosos prueban construcción, getAll, materialización, set, append, delete e iteración reales.

## Validación

- Cargo fmt, clippy sin warnings, cargo test y build Rust/JS: PASS; conteos y hash final en summary.json.
- Node22.12.0/24.20.0: 177/177 tests específicos FormData por versión.
- Binding real: vacío, vista completa y subvista con offset; getter global, length/buffer/byteLength/byteOffset/iterator reemplazados no se ejecutan; IDs permanecen intactos y se rechazan argumentos no Float64Array.
- GC: warmup y seis ciclos de500 arrays/buffers reales, todos recolectados tras dos muestras claras; heap/externa/RSS crudos en ../../memory/formdata-native-length/. La suite existente también valida Window/Document separados y caches/capacidad con FormData padre vivo; sus reportes están copiados como host-owners-v*.json.
- Addon baseline b3fcad02 reutilizado sólo para reproducción/medición tras verificar147fuentes byte a byte; candidata compilada propia. No se repitieron validate ni paquetes completos, reservados para la unión.

## Costos

Harness existente sin cambios: `node --expose-gc benchmarks/compare.cjs form-data-get-all`. Cada versión alterna procesos jsdom/rustdom, tres warmups y nueve muestras por proceso:18muestras por motor/tamaño. Cada muestra realiza100getAll con100/1000entradas; setup, validación yGC quedan fuera del tiempo. Ventana coordinada sin otras cargas.

| Node | Entradas | Baseline ms | Candidata ms | Cambio bruto | Control jsdom |
| --- | ---: | ---: | ---: | ---: | ---: |
| v22.12.0 | 100 | 2.225 | 2.076 | -6.7% | +3.7% |
| v22.12.0 | 1000 | 12.318 | 13.092 | +6.3% | -5.0% |
| v24.20.0 | 100 | 1.925 | 1.948 | +1.2% | +1.5% |
| v24.20.0 | 1000 | 11.451 | 12.236 | +6.9% | +2.2% |

Se conservan las regresiones medidas y los controles; no se afirma mejora ni equivalencia estadística. Los rangos, muestras, hardware, versiones y hashes están en los cuatro reportes completos enlazados por ../../benchmarks/formdata-native-length/comparison.json. Son pruebas finitas de una máquina, no una certificación universal de memoria o compatibilidad.
