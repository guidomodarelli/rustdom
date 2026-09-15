# PR67: unión final validada

El 15 de septiembre de 2026 se validó la unión de `e717ba14b7bd6683eebe3380c729ca8f2f1b2134` con main `ece7d46c9cdb94eea3c23e517b341771ee9719d4`, incorporando los fixes locales `b09cc02491d20b79270c01c69006c336f0edbae7` y `6efabc803cd1a91979bccdeb9705371490956b42`, más la protección de métodos de colecciones y Array de FormData.

## Cambio y decisiones

- FormData mantiene el orden y control nativos, con propietarios File visibles para V8. Captura los constructores y operaciones privadas de Map/WeakMap/Set y la fábrica Array.from para preservar las operaciones cuando el consumidor reemplaza esos globals o métodos. El Set temporal se llena mediante el add capturado y conserva complejidad lineal para la eliminación de duplicados.
- XML obtiene la clave intrínseca de iteración sin leer Symbol.prototype.constructor. Node-API enumera las claves y una función JavaScript efímera usa for-of para identificar la clave que consulta el motor. Se ejecuta una vez por Env, no se exporta ni retiene; la serialización permanece en Rust.
- El fixture VM carga el paquete mediante el módulo real de Node para evitar el cargador síncrono incompatible de Vitest en Node22.12. Conserva el DOM real, las trazas de Abort y la comprobación de tres estados nativos.
- Los conflictos de ocho reportes se resolvieron preservando ambos padres. El documento ci-npm de main agrega contexto a la misma evidencia. La detección de renames se deshabilitó porque consultaba blobs históricos no disponibles; no había renombres de código que resolver.

## Validación final ejecutada

| Gate | Resultado |
|---|---|
| `npm run validate`, Node24.20.0 | 7/7 aprobados |
| Formato, Clippy y Rust | 249 tests aprobados |
| Node | 2108/2108 aprobados |
| Jest | 18/18 aprobados |
| Vitest | 29/29 aprobados |
| vmForks/vmThreads | 30/30 aprobados |
| HTML5 corpus | 1784/1784 comparables; ocho casos script-on excluidos |
| WPT | 181/181 fixtures en paridad; 48812 resultados |
| Focal FormData, Node22.12.0 | 120/120 aprobados, incluidos Array y métodos de colecciones |
| Paquete Node24.20.0/npm11.19.0 | 20/20 gates, npm y pnpm |
| Paquete Node22.12.0/npm11.19.0 | 20/20 gates, npm y pnpm |
| Memoria FormData | 28 escenarios aprobados |
| Estrés de memoria | 1000 ciclos; 1100 listas creadas y liberadas |
| Benchmark FormData | seis casos completos; cuatro procesos, tres warmups y nueve muestras por proceso/caso |

Los WPT registran 47615 aprobaciones de estándares y 1197 fallos compartidos. El reporte conserva `complete: false`, el bloqueo CDATA de range-deletion y la exclusión del click real de submitter. Este corpus no acredita compatibilidad total.

Los logs y el detalle de los gates están en `pr67-final/`. Los reportes de instalación son `../distribution/2026-09-15T18-53-26.169Z-linux-x64.json` y `../distribution/2026-09-15T18-55-08.370Z-linux-x64.json`; incluyen los lockfiles de los consumidores y la identidad del archivo instalado.

## Identidades y entorno

La copia de validación en `/home/guido/rustdom-pr67-validation-0VAe7q` usó fuentes idénticas por hash a la unión de Windows. `pr67-final/source-copy.json` conserva ambas capturas. Hash de fuentes: `f87b7e83c21b723531c5a75306734a4b43a86b511298edd02806d91496d7f8b4`.

El addon construido y ejercido tiene SHA-256 `1f5cb1d86c660f6e1681638474c64e45d6de6c84b67919c5cc70be6a1b452f83`. El mismo paquete se instaló en ambos Node: SHA-256 `6f6502937d6ad5ab5dc76da8fa1f46b024b9f16f9ec3541d1c96376ca9efbd11`, archivo `rustdom-rustdom-0.1.0-alpha.0-linux-x64-glibc-2026-09-15T18-53-24.434Z.tgz`. La copia de ese archivo a artifacts del clon Windows se verificó por SHA-256. El dist anterior de Windows no se usa como evidencia del runtime final.

La batería anterior de Node22 sobre `/mnt/c` terminó con tres timeouts de lectura; los procesos fueron observados esperando p9_client_rpc. No se aumentaron límites ni se alteraron assertions. Con los mismos archivos de runtime/helpers/lock, los tres casos seleccionados pasaron y la batería completa pasó 106/106 en almacenamiento Linux. El rojo, la reproducción y sus tiempos permanecen en `pr67-union/`. Es un diagnóstico del entorno de ejecución, no una mejora de rendimiento del producto.

## Benchmarks y memoria

Muestras finales: `../benchmarks/2026-09-15T18-57-59.902Z-linux-x64.json`. Se midieron operaciones públicas, se validaron resultados equivalentes y se registraron las fuentes modificadas. Las medianas jsdom/rustdom fueron: set100 1.26×, delete100 0.74×, construct100 0.29×; set1000 2.20×, delete1000 2.09×, construct1000 0.21×. La construcción sigue más lenta en ambos tamaños y delete pierde a 100 campos. No se atribuyen diferencias respecto a corridas previas exclusivamente al fix: también cambian Node y almacenamiento.

El escenario final de memoria está en `../memory/2026-09-15T18-52-31.699Z-form-data.json`. En el estrés no quedaron FormData/Document/Window observados, entradas, capacidades ni operaciones activas, y cleanupErrors quedó en cero. La inicialización XML tiene además su benchmark y 30 Workers separados en `pr67-symbol-intrinsics.md`; la mediana del candidato fue ligeramente mayor, con rangos superpuestos. Estas pruebas finitas no prueban ausencia universal de fugas ni memoria pico.

El WPT completo se conserva sin pérdida en `../compatibility/2026-09-15T18-50-27.969Z-linux-wpt.json.gz`: 44962922 bytes originales, 538820 comprimidos, roundtrip idéntico. `pr67-final/wpt-summary.json` conserva hashes y exclusiones.

## Límites de publicación

La evidencia anterior al fix de prototipos, incluido el paquete que falló en VM Node22, está separada en `pr67-union/pre-prototype-fix/`. No se presenta como validación de este estado. El CI del SHA publicado todavía debe ejecutar todos sus gates, incluido Memcheck de Linux, y recibir revisión del SHA vigente antes del merge y checkpoint. El objetivo global de migración y compatibilidad completa sigue pendiente.
