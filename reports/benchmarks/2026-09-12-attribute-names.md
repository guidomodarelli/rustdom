# Enumeración de nombres de atributos

Se reemplazó la búsqueda repetida `Vec::contains` por deduplicación con `HashSet` temporal y hashing aleatorio. Se conservan el orden de primera aparición, el filtro Unicode del host y los nombres repetidos que devuelve `getAttributeNames()`. El conjunto toma prestados los slices del resultado; no copia el contenido UTF-16 para guardar claves.

La comparación usa el estado publicado `0e046176b1367fed802b6099bdcbcd2f65896aad` como baseline y el mismo código de producción con esta corrección como candidato. Ambos binarios se construyeron en el mismo clon con Cargo release y thin LTO. Los hashes del addon y de las fuentes medidas están en los JSON; las modificaciones posteriores de fixtures Rust no forman parte del binario release.

| Operación | Atributos | Baseline ms | Candidato ms | Baseline / candidato | jsdom ms |
|---|---:|---:|---:|---:|---:|
| `Reflect.ownKeys` | 128 | 0,1123 | 0,0919 | 1,22x | 0,0401 |
| `Reflect.ownKeys` | 1.024 | 2,2620 | 0,8589 | 2,63x | 0,3608 |
| `Reflect.ownKeys` | 4.096 | 24,7035 | 4,2030 | 5,88x | 1,9594 |
| `NativeTree.attributeNames` | 128 | 0,0537 | 0,0344 | 1,56x | — |
| `NativeTree.attributeNames` | 1.024 | 1,6524 | 0,2701 | 6,12x | — |
| `NativeTree.attributeNames` | 4.096 | 22,5210 | 1,2971 | 17,36x | — |

Son medianas por llamada. Aunque mejora frente al baseline en todos estos tamaños, rustdom todavía tarda aproximadamente 2,15 veces lo que jsdom en la ruta pública de 4.096 atributos. La mejora de la frontera nativa no equivale al rendimiento de toda una suite Jest o Vitest.

## Método y reproducción

- `node --expose-gc benchmarks/attribute-names.cjs baseline` sobre el addon anterior y `node --expose-gc benchmarks/attribute-names.cjs hashset` sobre el candidato.
- Rust 1.98.1 (`48a229cea`, 2026-09-01), Node 24.14.1, jsdom 27.4.0 y Unicode 17.0. Intel Core i7-1360P, 16 CPUs lógicas, WSL2 Linux 6.6.87.2; hardware y hashes de dependencias en los JSON.
- Dos procesos nuevos por motor, orden alternado jsdom/rustdom y rustdom/jsdom. Tres warmups y nueve muestras por proceso: 18 muestras conservadas por fila.
- Cada muestra contiene 40, 10 o 3 llamadas para 128, 1.024 o 4.096 atributos, respectivamente. Se guarda el tiempo por llamada sin descartar outliers.
- Se incluyen la operación pública y el filtrado de claves Symbol, o la llamada N-API con transferencia UTF-16. Preparación, importación, GC, validación y teardown quedan fuera del timer.
- Todas las muestras validan la lista ordenada completa. Los hashes de resultados públicos coinciden entre ambos motores.
- Las mediciones corrieron sin builds, tests ni otros benchmarks de esta tarea o sus subagentes.
- Los nombres son cortos y únicos; las pruebas funcionales cubren por separado nombres repetidos en namespaces diferentes, Unicode y UTF-16 aislado. No se infiere rendimiento para todas las formas de documentos.
- Los snapshots de memoria posteriores al cierre y GC no son memoria pico ni una prueba absoluta de ausencia de fugas. Cada fixture nativo libera todos sus handles y comprueba contadores en cero.

Datos crudos: [baseline](2026-09-12T01-13-14.317Z-attribute-names-baseline.json) y [candidato](2026-09-12T01-14-17.173Z-attribute-names-hashset.json).
