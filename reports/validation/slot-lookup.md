# Búsqueda de slots en Rust

`findSlot` conserva los guards de padre, ShadowRoot y modo abierto en el
driver. Rust recorre los enlaces ordinarios en preorder y devuelve el primer
slot HTML cuyo atributo `name` sin namespace coincide con el nombre del
slotable. Usa el snapshot que actualiza la frontera canónica de atributos;
no crea índices, cachés ni referencias persistentes nuevas.

El nombre llega mediante el transporte UTF-16 existente de N-API. Se mantiene
el estado original `_slotableName`, actualizado por los hooks, para conservar
también particularidades de atributos con namespace. Los contenidos separados
de templates, otros hosts y nodos fuera de la raíz no entran en el recorrido.

Cuatro pruebas públicas pasaron antes y después de migrar: slots duplicados,
orden, renombres, slotchange, fallback, raíces abiertas/cerradas, adopción,
namespaces, mayúsculas, NUL y surrogates aislados. Los cuatro tests Rust del
módulo y Clippy también pasaron. El primer fixture Rust intentaba insertar un
nodo todavía adjunto; se corrigió la preparación para hacer detach, conforme
al contrato nativo, sin cambiar aserciones ni comportamiento de producción.

Un quinto contrato ejercita N-API: nombres UTF-16, handles inválidos y
reservados, cambio del Attr canónico, liberación de atributos y nodos, y
contadores que no cambian por las consultas o entradas rechazadas. Pasó con
las cuatro pruebas públicas sobre el addon real.

Memcheck aprobó los cuatro tests Rust del módulo, con cero errores y cero
pérdidas definitivas o indirectas. Conserva los 48 bytes posibles y 544
alcanzables de std/libtest, sin supresiones, en
`../memory/2026-09-13T01-30-54.909Z-slots-valgrind.log`, con logs de pruebas y
hash del ejecutable junto al informe.

El estrés ampliado de cinco modos pasó en
`../memory/2026-09-13T01-32-04.188Z-linux-x64.json`. Observa también el slot,
un Element y un Text asignados, y cambia su asignación antes del teardown.
Rustdom liberó los 1.322 documentos y 882 ventanas; cada Vitest liberó 1.320
documentos y 880 ventanas. Heap/RSS: 2,71/18,14 MiB rustdom, 4,00/42,93 MiB
Vitest, 3,63/43,59 MiB VM. Las pruebas finitas y RSS no demuestran ausencia
absoluta de fugas ni miden memoria pico.

La validación completa pasó **142 tests Rust, 487 contratos Node, 7 Jest,
18 Vitest y 26 en pools VM**, además de 1.784 casos HTML5 comparables. WPT
mantiene 43.708 casos ejecutables en paridad: 42.678 aprobados por el estándar
y 1.030 fallos compartidos. El informe
`../compatibility/2026-09-13T01-36-57.588Z-linux-wpt.json` conserva el bootstrap
bloqueado de Range-deleteContents; esa exclusión impide afirmar conformidad
completa. El cambio de infraestructura de diagnósticos se integró después
del build sin diferencias en el código del runtime.

La asignación de listas, el aplanado, la entrega de slotchange y otros drivers
siguen pendientes. Esta búsqueda no completa la implementación de slots.

## Rendimiento

El benchmark `../benchmarks/2026-09-13T01-29-51.012Z-linux-x64.json` guarda
18 muestras por motor y caso, con preparación fuera del timer y sin otra carga
local. Las consultas consumen 1.000 identidades de assignedSlot sobre un host
con 25/100 slots; las reasignaciones alternan 100 veces el nombre y consultan
su identidad, incluidos hooks. Se validan todas las listas assignedNodes y los
hashes del documento y contenido shadow.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| 1.000 lecturas de assignedSlot | 25 slots | 4,253 | 3,371 | 1,26× |
| 100 reasignaciones y lecturas | 25 slots | 1,966 | 1,943 | 1,01× |
| 1.000 lecturas de assignedSlot | 100 slots | 12,440 | 10,557 | 1,18× |
| 100 reasignaciones y lecturas | 100 slots | 3,514 | 3,375 | 1,04× |
| 1.000 consultas de raíces shadow | 25 niveles | 2,527 | 2,071 | 1,22× |
| 1.000 consultas de raíces shadow | 100 niveles | 9,773 | 5,539 | 1,76× |
| Crear 100 hosts con contenido | 25 filas base | 6,579 | 7,337 | 0,90× |
| Despachar 100 eventos entre ramas | 10 niveles por rama | 13,948 | 8,771 | 1,59× |
| Despachar 100 eventos entre ramas | 30 niveles por rama | 161,487 | 26,364 | 6,13× |

Ratio = mediana jsdom / mediana rustdom. Las consultas de slots mejoran en
estos patrones y la reasignación queda cerca de la paridad. Se conserva el
costo mayor de creación de hosts en esta corrida. No se afirma una mejora
causal contra el commit anterior ni una aceleración general de los runners.

## Distribución

El paquete con SHA-256
`38d4dc6065550c0d08c8d85064283a625f8f3a9f843ecd8853e155e623d66b1f`
pasó 18 controles en Node 24.14.1 y 18 en Node 22.12.0, con instalaciones
npm/pnpm fuera del checkout y consumidores CJS/ESM y runners reales. Los
consumidores verifican findSlot nativo y cambios de assignedSlot dentro de VM.
Informes: `../distribution/2026-09-13T01-40-27.945Z-linux-x64.json` y
`../distribution/2026-09-13T01-42-29.254Z-linux-x64.json`.
