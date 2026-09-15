# DOMStringMap / dataset nativo

Los algoritmos de enumeración, búsqueda y conversión de nombres de dataset usan
Rust sobre Attr canónicos. El Proxy WebIDL original conserva descriptores, símbolos,
herencia y orden de conversión de valores. El host aplica escrituras/borrados con
los hooks existentes, después de la validación nativa.

La enumeración usa localName, sin filtrar namespace, y deduplica en orden de
atributos. La lectura devuelve la primera coincidencia. La escritura transforma
el nombre, valida XML Name y escribe en namespace nulo; el borrado usa el nombre
calificado y no aplica la validación del setter. Se conserva esta asimetría de jsdom.

Las conversiones se limitan a ASCII: -[a-z] se convierte a mayúscula y [A-Z]
se transforma en guion/minúscula. Los otros UTF16 se conservan. El getter usa la
transformación inversa para comparar localNames sin construir un match por atributo;
las claves con guion seguido de minúscula no pueden ser resultado de camelCase.
La validación reutiliza el helper XML existente en lugar de duplicar sus clases.

Las operaciones son stateless: no hay caches que retengan el Element ni nuevos
registros permanentes. El bridge guarda su owner visible a V8. Los contadores
nativos de actividad son acumulativos y no se confunden con memoria retenida.

## Evidencia focal

[Baseline](dom-string-map/baseline.log) e [integración](dom-string-map/integration.log)
pasaron 81 contratos públicos HTML/SVG/XHTML. Cubren nombres, namespaces, colisiones,
__proto__/constructor/toString, descriptores, símbolos, coerciones, errores, clones
y MutationObserver. Tres tests Rust verifican transformaciones, validación y orden;
cuatro contratos nativos ejercen atributos actuales, rechazos y activación real.

El [WPT focal](../compatibility/2026-09-14T23-09-22.516Z-linux-wpt.json) mantuvo 45
resultados en paridad con la referencia en los siete fixtures originales: 44
aprobados por el estándar y un fallo compartido. Se conserva como límite de
conformidad, sin modificar assertions.

El [control de memoria](../memory/2026-09-14T23-09-34.911Z-dom-string-map.json) pasó
seis ciclos con 1.000 atributos. Retener dataset conserva su owner; al soltarlo se
recolectan mapa, elemento, documento y ventana, aunque los arrays de claves/valores
siguen retenidos y válidos. Los contadores de memoria nativa vuelven al baseline.

## Validación general

[La validación completa](dom-string-map/validation.json) pasó formato, Clippy,
227 tests Rust, 1.567 Node, 10 Jest, 21 Vitest y 26 Vitest VM. La suite compartida
de runners ejerce dataset real. HTML5 mantuvo 1.784 casos comparables y ocho
exclusiones de scripting. El [WPT general](../compatibility/2026-09-14T23-20-32.682Z-linux-wpt.json)
registró 47.002 resultados en paridad, con 45.935 aprobados por el estándar y
1.067 fallos compartidos. El bootstrap de Range-deleteContents sigue excluido.

## Memoria y distribución

El [GC focal final](../memory/2026-09-14T23-23-01.485Z-dom-string-map.json) pasó
seis ciclos. El [estrés general](../memory/2026-09-14T23-24-26.514Z-linux-x64.json)
aprobó los cinco modos: rustdom liberó 1.762 documentos y 882 ventanas observados;
cada modo Vitest liberó 1.760 documentos y 880 ventanas. Los arrays conservados de
claves/valores no impidieron recolectar sus owners. Se conservan deltas RSS de
20,42 MiB, 40,80 MiB y 42,09 MiB para rustdom, vitest y vitest-vm.

[Memcheck](../memory/2026-09-14T23-24-26.000Z-dom-string-map-valgrind.log) ejecutó
los tres tests Rust sin errores ni bytes definitivamente o indirectamente perdidos.
Conserva 48 bytes posiblemente perdidos y 544 alcanzables de std/libtest, sin
supresiones. Estos controles finitos no demuestran ausencia absoluta de fugas.

El binario final tiene SHA-256
`c32f5116e46155cbdea9f21e894a360af3f043ae601c3c62c2640b6c4040172e`.
El mismo archivo de paquete, SHA-256
`34222b1696fd4d4bac19a7d0370ca4f9b4da58c20dd01f294265a2f9cd298de3`,
pasó los 18 controles de instalación en [Node 24](../distribution/2026-09-14T23-25-30.288Z-linux-x64.json)
y los 18 en [Node 22](../distribution/2026-09-14T23-27-35.996Z-linux-x64.json).
Incluyen consumidores npm/pnpm, tipos, CJS/ESM/VM, workers y runners reales.

## Rendimiento medido

El [benchmark final](../benchmarks/2026-09-14T23-32-24.660Z-linux-x64.md)
conserva [muestras crudas, hashes y metodología](../benchmarks/2026-09-14T23-32-24.660Z-linux-x64.json).
Se midieron 18 muestras por fila, en dos procesos por motor, con tres warmups
por proceso, Node 24.14.1, jsdom 27.4.0 e Intel i7-1360P bajo WSL2. Preparación,
validación de cada resultado y limpieza quedan fuera del tiempo; los cruces
N-API y los hooks de mutación de cada operación pública quedan incluidos.

| Operación | Atributos | jsdom mediana (ms) | rustdom mediana (ms) | jsdom / rustdom |
|---|---:|---:|---:|---:|
| Lectura | 4 | 0,110 | 0,078 | 1,41× |
| Enumeración | 4 | 0,141 | 0,123 | 1,15× |
| Escritura | 4 | 0,168 | 0,234 | 0,72× |
| Borrado | 4 | 0,165 | 0,249 | 0,67× |
| Lectura | 1.000 | 57,063 | 9,886 | 5,77× |
| Enumeración | 1.000 | 110,783 | 19,960 | 5,55× |
| Escritura | 1.000 | 62,500 | 146,395 | 0,43× |
| Borrado | 1.000 | 3,118 | 70,268 | 0,04× |

Lecturas y enumeración favorecen a rustdom en estas entradas. Escritura y borrado
son más lentos; en 1.000 atributos el borrado tarda aproximadamente 22,5 veces
lo que jsdom. La medición compara motores completos: no atribuye por sí sola
esa diferencia al nuevo algoritmo ni demuestra una regresión frente al hito
anterior de rustdom. Hace falta perfilar el camino de mutación compartido.

Los 11 tests del arnés de benchmarks también pasaron. Los dos archivos
`*-failed.json` de 23:29 son diagnósticos deliberados de sus casos de deadline y
rechazo de worker; se conservan como evidencia y no son muestras del benchmark
final de dataset. Este hito valida compatibilidad en el corpus ejecutado, no
completa la migración general ni acredita rendimiento superior en toda operación.
