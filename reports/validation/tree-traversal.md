# Recorridos DOM nativos

NodeIterator y TreeWalker usan un cursor Rust con root/current, máscara, orientación
y estado activo. Los nueve movimientos, aceptación, rechazo, salto de candidatos y
reparación de referencias antes de eliminar nodos operan sobre TreeStore.
La topología se consulta después de cada callback; no se captura un árbol congelado.

El controlador devuelve una solicitud de filtro y termina su préstamo nativo antes
de ejecutar JavaScript. El host limpia el flag activo en finally y luego convierte
el resultado a unsigned short; una conversión puede reentrar. No se rechazan llamadas
anidadas que terminan sin candidato. TreeWalker admite currentNode fuera del root,
igual que la referencia fijada. Los enlaces no mezclan Attr owners ni shadow hosts.

Los nodos, filtros y realms se conservan como referencias visibles a V8. Cursor y
operación nativos solo mantienen escalares y tokens débiles de identidad; no retienen
JavaScript ni el forest. La API nativa rechaza operaciones de otro cursor/forest y
continuaciones sin respuesta de filtro. Los contadores de ambos objetos se incluyen
en el endpoint de memoria, además de observar por separado Document y Window.

## Contratos y validación

- La base previa pasó 150 contratos públicos contra jsdom 27.4.0.
- La primera integración nativa pasó los mismos 150 contratos.
- Se añadieron 48 secuencias sembradas de 80 movimientos: 3.840 decisiones comparadas,
  además de los casos de máscaras, poda, excepciones, reentradas, adopción y remoción.
- Cuatro tests Rust verifican movimientos, poda, reanudación y reparación de referencias.
- Las pruebas nativas ejercen el protocolo real y la integración pública; no inspeccionan
  strings de código ni reemplazan la plataforma con mocks.
- [La validación general](tree-traversal/validation.json) pasó formato, Clippy,
  218 tests Rust, 1.112 Node, 7 Jest, 18 Vitest y 26 Vitest VM. Los 1.784 casos
  HTML5 comparables aprobaron; permanecen ocho casos de scripting excluidos.
- El [corpus previo](../compatibility/2026-09-13T21-02-26.075Z-linux-wpt.json)
  mantuvo 43.708 resultados en paridad: 42.678 aprobados por el estándar y 1.030
  fallos compartidos. El bootstrap de Range-deleteContents permanece bloqueado.

Los [16 fixtures adicionales de WPT](../compatibility/2026-09-13T21-05-31.040Z-linux-wpt.json)
producen 1.598 resultados en paridad, con 1.572 aprobados y 26 fallos compartidos.
Se conservaron sin modificaciones desde la revisión WPT fijada en el manifest,
junto con sus recursos y hashes. Los fallos compartidos incluyen 20 reparaciones
de NodeIterator al retirar ancestros de su root y seis casos de realms/iframe.
La migración preserva esos comportamientos de jsdom; no se presenta como una
implementación conforme con todo el estándar. El subdirectorio upstream unfinished
contiene borradores XML fuera del corpus ejecutable incorporado.

## Memoria

La [revisión de ownership](tree-traversal/ownership-review.md) no encontró ciclos
fuertes ocultos. Los [ocho ciclos focales](../memory/2026-09-13T20-55-07.434Z-tree-traversal.json)
verifican que conservar cursores conserva nodos/filtros y que soltarlos permite
recolectar cursores, filtros, roots, Document y Window. Las operaciones suspendidas
se liberan también cuando el callback lanza; los contadores vuelven al baseline.

[Memcheck](../memory/2026-09-13T21-05-41.000Z-tree-traversal-valgrind.log) pasó los
cuatro tests del núcleo: cero errores, cero bytes definitivamente perdidos y cero
indirectamente perdidos, sin supresiones. Conserva 48 bytes posiblemente perdidos
y 544 alcanzables de std/libtest, con hash del ejecutable y log de tests.
El [estrés general](../memory/2026-09-13T21-07-05.589Z-linux-x64.json) pasó jsdom,
rustdom, native, vitest y vitest-vm. Rustdom liberó los 1.322 documentos y 882 ventanas
observados; cada modo Vitest liberó 1.320 documentos y 880 ventanas. Los contadores
de cursores/operaciones y del resto del árbol volvieron al baseline. Se conservan
deltas RSS de 21,86 MiB en rustdom, 44,27 MiB en vitest y 42,78 MiB en vitest-vm;
las comprobaciones de liveness no se presentan como prueba de RSS nulo.

La [repetición de los 198 contratos DOM](tree-traversal/bounded-regression.log)
pasó después de limitar el bucle de preparación del test de remoción. El límite
hará fallar el test si deja de alcanzar su referencia, en lugar de dejarlo colgado.
No cambió el runtime después de la validación general.

## Distribución

El primer archivo con SHA-256
`5ac44cf2026e4718a02e9afc750f2939ad16fdcf58ecdf6b0ce01ab8c4e5952e` y binario nativo
`3c2134600af26832e8e0c6edb4e0abcc85908b2311f11ff7d96fb96153a31a88` falló en el
[consumidor instalado](../distribution/2026-09-13T21-08-26.815Z-linux-x64.json):
la lista explícita de archivos del paquete omitía tree-cursor.cjs. Se corrigió
scripts/package.mjs; se conserva el fallo original y se repite la instalación
con un nuevo archivo, sin cambiar el binario nativo ni debilitar los tests.
Los consumidores CJS/ESM tipados ejercen movimientos reales del nuevo cursor.
El archivo corregido tiene SHA-256
`a71fe42f2ecf14fb906335282e3e01e157035c644f02074f9681259fc9c45176` y pasó los
[18 controles en Node 24](../distribution/2026-09-13T21-11-57.666Z-linux-x64.json):
npm/pnpm, tipos, CJS, ESM/VM, Unicode, workers, Jest y Vitest reales.
El mismo archivo pasó los [18 controles en Node 22](../distribution/2026-09-13T21-13-34.714Z-linux-x64.json).
Los 11 tests del arnés de benchmarks también aprobaron. El hito queda validado
localmente para publicación en PR; el checkpoint en main requiere completar
la revisión del SHA y el CI remoto correspondiente.

## Rendimiento

Los benchmarks iterator-scan, iterator-filter, walker-scan y walker-filter miden
recorridos completos de tablas de 100/1.000 filas. Preparan el cursor fuera del tramo
medido; dentro se recorren nodos, se ejecutan filtros reales y se consumen nombres.
Después se verifican todas las identidades y el número de callbacks. Se guardan las
muestras crudas y también las regresiones. Migrar a Rust no acredita una aceleración.

La [medición final aislada](../benchmarks/2026-09-13T21-18-41.209Z-linux-x64.json)
conserva 18 muestras por motor/operación en dos procesos por motor, tres warmups
y orden alternado. No hubo builds, tests ni controles de memoria concurrentes.

| Operación | Filas | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| iterator-scan | 100 | 0,375 | 1,333 | 0,28× |
| iterator-filter | 100 | 0,323 | 1,390 | 0,23× |
| walker-scan | 100 | 0,242 | 1,366 | 0,18× |
| walker-filter | 100 | 0,315 | 1,303 | 0,24× |
| iterator-scan | 1000 | 3,075 | 13,325 | 0,23× |
| iterator-filter | 1000 | 2,987 | 14,025 | 0,21× |
| walker-scan | 1000 | 2,538 | 13,549 | 0,19× |
| walker-filter | 1000 | 2,766 | 14,251 | 0,19× |

Ratio = mediana jsdom / mediana rustdom. El recorrido completo sigue siendo
entre 4,3 y 5,3 veces más lento en las tablas de 1.000 filas. Se conserva como
regresión medible: todavía queda trabajo de optimización del bridge y las
operaciones suspendidas. No se atribuye causalidad solo a partir de esta tabla.
