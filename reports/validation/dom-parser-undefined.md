# DOMParser y CharacterData interno undefined

Validación iniciada el 20/10/2026 sobre `feature/native-dom-parser`, a partir de
`b38f503bb668587bde8f93fa8dbacb170fe2c579`. El árbol inicial estaba limpio;
no había cambios ajenos pendientes. La referencia independiente es jsdom 27.4.0.

## Problema reproducido

La rama publicada fallaba en cuatro de sus 170 contratos DOMParser en Node
22.12.0 y 24.14.1. Al lanzar un número o símbolo durante la creación XML,
`error.message` es undefined: jsdom crea un Text con ese dato, mientras rustdom
lo rechazaba al convertir el argumento de N-API a Utf16String. La diferencia
ya estaba presente antes del controlador, como registra la evidencia de septiembre.

No se cambiaron las expectativas de esos cuatro casos. Las regresiones nuevas
comparan operaciones reales con el jsdom independiente.

## Decisiones de implementación

- `DomString::Undefined` representa el dato canónico en Rust, sin propietario
  JavaScript ni mapa lateral. Se omite de serde: esto no habilita `null` ni
  objetos como datos válidos del contrato JSON de snapshots.
- Los getters N-API distinguen undefined, null y cadenas. La igualdad conserva
  la diferencia frente a Text vacío o la cadena `"undefined"`; la concatenación
  del padre sí usa esa cadena, como la referencia.
- `wholeText` conserva el orden sujeto/previos/siguientes de la suma JavaScript.
  Dos undefined pueden producir NaN; una cadena posterior puede convertirlo a
  texto. La ruta normal sigue siendo lineal; la excepcional reúne piezas
  prestadas y las copia una vez, sin retener referencias al DOM.
- Los consumidores de longitud conservan TypeError intrínseco, mensaje, realm
  y ausencia de un código sintético. Se incluyen Range, clone/extract/delete
  y los controladores que pueden fallar después de crear un fragmento.
- `normalize()` concatena los datos de los siblings antes de las lecturas
  tardías de longitud. Cuando no hay rangos vivos, un único recorrido Rust
  comprueba los siblings actuales después de `replaceData` y sus hooks. Con
  rangos vivos se conserva la entrega existente. No se agregó un espejo JS
  del estado ni un cruce N-API por sibling en la ruta optimizada.
- HTML conserva el error de `substring` en texto escapado y la conversión en
  texto raw. XML conserva el error de `replace` y su DOMException pública.

## Evidencia confirmada

| Comprobación | Resultado |
| --- | --- |
| Reproducción inicial Node 22/24 | 166/170 aprobados en ambos |
| Clippy, todos los targets, warnings como errores | Aprobado |
| Tests Rust | 259 aprobados |
| Contratos focales y prueba de GC en Node 22.12.0 | 279 aprobados |
| Contratos focales y prueba de GC en Node 24.14.1 | 279 aprobados |
| Contratos generales Node en ambas versiones | 2.757 aprobados por versión |
| Runners reales en ambas versiones | Jest 20, Vitest 31 y VM 30 aprobados por versión |
| Corpus HTML5 | 1.784 comparados compatibles; 8 script-on excluidos |
| WPT | 221 fixtures en paridad; 82.939 assertions comparadas |
| Memcheck | 259 tests completos, 9 lotes; sin accesos inválidos ni fugas definitivas/indirectas |
| Paquete instalado npm/pnpm | 20 controles por versión, 40 aprobados en total |
| Benchmarks antes/después | 8 procesos; 14 muestras por motor/escenario/versión/estado |
| Review independiente, reviewer nativo Codex | Dos hallazgos corregidos; segunda revisión sin hallazgos accionables |

El reviewer confirmó 76 escenarios por versión, incluidos `normalize()` con y
sin rangos vivos, mutaciones parciales, MutationRecords, límites y seis métodos
de Range. Las pruebas versionadas cubren esas familias de regresiones.

Los [siete gates generales](dom-parser-final/release-gates.json),
[logs por gate](dom-parser-final/gates/) y
[manifiesto de 240 archivos de evidencia](dom-parser-final/evidence.json)
permiten verificar los resultados y sus SHA-256. Se preservan también los
fallos intermedios y las incidencias del entorno. Los JSON grandes se guardan
con gzip sin pérdida; el manifiesto incluye hashes de datos originales y comprimidos.

Identidades verificadas antes de publicar:

- Fuentes de producción/tooling medidas, 292 archivos:
  `fcc99ca423416be601a4110052187ebb202eda958ec8c0293e3dc388e025c295`.
  Coincide entre el checkout y el runtime Linux validado. La base Git de la
  captura es b38f503; los cambios estaban sin commit al medir, como registra
  [source.json](dom-parser-final/source.json).
- Addon Linux x64/glibc, N-API 8:
  `3e9026cefd8815b54747240cab0f46e684b038eb9ea13107ba1dc3b6cb2731d8`.
- El mismo paquete instalable en ambos Node:
  `4aa4d143fd4a87219201ee5686205c182a70ce40b583c70446ccfe8422c0d9ee`.

Toolchain: Rust/Cargo 1.98.1, Node 22.12.0 y 24.14.1, npm 11.19.0 para
instalación en Node 22. Build release con el perfil versionado en Cargo.toml.
La evidencia local es Linux x64/WSL2; Windows y macOS requieren sus checks de CI.

La continuación de CI reemplaza un atomic deprecado en Rust 1.99.1 y agrega
tres regresiones de concurrencia. Sus 262 tests Rust, validación repetida de
Node 22/24, paquete, Valgrind y benchmarks con el mismo compilador están en
[compatibilidad con Rust 1.99](rust199-atomic.md). Sus hashes se conservan por
separado: los hashes y mediciones anteriores corresponden al hito original.

WPT conserva los límites del arnés: 81.739 assertions cumplen el estándar y
1.200 fallan también en la referencia. Se excluye la interacción real de
`xhr/formdata/submitter-coordinate-value.html`; el bootstrap de
`dom/ranges/Range-deleteContents.html` sigue bloqueado por el fallo compartido
al clonar CDATA adoptada por HTML. La paridad de este corpus no certifica
cobertura completa ni conformidad total.

## Memoria y alcance

La prueba GC usa ambos motores y realms default/VM. Por combinación realiza un
warmup y cuatro ciclos medidos de veinte Windows. Observa Window y sus
Document por separado, documentos recuperados, parsers, textos, rangos, grupos
de normalización, objetos lanzados que poseen documentos y errores. Cierra
ventanas, abandona los propietarios fuertes y exige dos muestras claras en
turnos distintos, con GC mayor asíncrono y límites finitos. Se guardan heap,
memoria externa, RSS y contadores nativos.

La liberación observada solo respalda estos escenarios finitos; no prueba
ausencia absoluta de fugas ni confunde RSS retenido por el allocator con una fuga.

Memcheck conserva en cada proceso un diagnóstico de **48 bytes posiblemente
perdidos** y **544 bytes alcanzables**. Sus stacks apuntan a
`std::thread::current`/canal del harness `test` y a la inicialización de
`std::sys::pal::unix::stack_overflow`; son iguales al control anterior y a los
lotes sin árboles DOM. No se ocultaron ni se clasificaron como una fuga nueva
del árbol. Los nueve logs conservan **0 bytes definitivamente perdidos,
0 indirectamente perdidos y ERROR SUMMARY: 0**. Este control ejecuta el
binario de tests Rust; el addon cargado y sus referencias V8 se ejercen por separado
en las pruebas GC.

El estrés general también pasó en los cinco modos existentes. En rustdom se
liberaron 1.762 documentos y 882 ventanas observadas; heap retenido +1,94 MiB,
RSS +13,36 MiB frente al punto medido. Son valores posteriores a GC, no memoria
pico. Ver el [reporte completo](../memory/2026-10-20T16-50-14.850Z-linux-x64.json.gz).

## Rendimiento observado

Las [muestras y comparación](../benchmarks/dom-parser/README.md) miden operaciones
completas, incluido el puente. Frente al estado anterior, las medianas de las
operaciones comparables variaron entre -3,58% y +2,55% en esta máquina. El
baseline no ejecutaba correctamente la recuperación con undefined, por lo que
ese escenario no tiene comparación de velocidad antes/después.

El parsing pequeño todavía cuesta aproximadamente 1,17–1,35 veces el tiempo de
jsdom en estas muestras. `normalize()` cuesta 2,31–3,57 veces. Son pendientes
reales de rendimiento ya presentes en el baseline; el arreglo no los convierte
en mejoras. El control jsdom de `wholeText` en Node 22 varió aproximadamente
2,14 veces entre grupos, por lo que no se extrae una conclusión de velocidad
general a partir de esas muestras submilisegundo.

## Incidencias del entorno de validación

- El primer runtime final copió fuentes y fixtures sin el árbol de directorios
  de reportes versionados. El helper preexistente de AbortSignal intentó escribir
  un reporte sin crear su carpeta. Se restauró la estructura de directorios del
  checkout y se repitió la validación, sin cambiar assertions ni producto por
  esa incidencia.
- La instalación de consumidores con npm 10.9.0 de Node 22 falla dentro de npm
  con `Cannot read properties of null (reading 'edgesOut')`. CI ya fija npm
  11.19.0. Se instaló esa versión local para repetir la comprobación equivalente.

El motor sigue siendo híbrido: factories, WebIDL, hooks, drivers y otras APIs
mantienen trabajo pendiente. Esta corrección no certifica compatibilidad total
ni cierra el objetivo de reescribir toda la implementación en Rust.
