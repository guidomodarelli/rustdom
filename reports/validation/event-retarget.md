# Retargeting de eventos en Rust

El helper utilizado por la entrega real de eventos delega en Rust la selección
del target visible desde una referencia. Conserva los guards originales antes
de inspeccionar referencias irrelevantes y devuelve el mismo objeto vivo desde
su handle numérico. Los hosts de templates no se cruzan como ShadowRoot.

El caso que ya comparte raíz termina sin asignar un conjunto de ancestros.
Después del primer cruce fallido se reúne una única vez el conjunto temporal
de raíces shadow de la referencia y se reutiliza. No hay caché persistente,
nuevos owners ni cambios al árbol. Los recorridos tienen presupuesto para
devolver un error controlado ante ciclos creados por la API nativa de bajo nivel.

## Contratos y memoria nativa

Tres tests Rust nuevos cubren raíces anidadas, templates, árboles separados,
inputs inválidos, reservas, ciclos y liberación posterior. Cuatro contratos
Node comparan con el jsdom 27.4.0 independiente: orden de guards, identidades
en todas las parejas de árboles de 24/12 niveles, detach/adopt, target,
relatedTarget, composedPath y llamadas a listeners reales. También verifican
la API N-API sin cambios en contadores ni aceptación de handles reservados.

La validación completa aprobó **138 Rust, 482 Node, 7 Jest, 18 Vitest y 26 VM**,
además de 1.784 casos HTML5 comparables. El informe WPT
`../compatibility/2026-09-13T00-48-02.178Z-linux-wpt.json` conserva los límites
del corpus y el bootstrap bloqueado de Range-deleteContents; no acredita
compatibilidad completa con el estándar.

Los ocho tests del módulo de hosts pasaron bajo Valgrind/Memcheck:
`../memory/2026-09-13T00-43-12.301Z-retarget-valgrind.log` y sus logs de tests
y hash del ejecutable. Cero errores, cero bytes perdidos definitivos o
indirectos, 48 bytes posibles y 544 alcanzables de std/libtest, sin supresiones.

El estrés general de cinco modos pasó en
`../memory/2026-09-13T01-05-41.275Z-linux-x64.json`. Rustdom liberó 1.322
documentos, 882 ventanas y 11.900 nodos comparados; cada entorno Vitest liberó
1.320 documentos, 880 ventanas y 8.800 nodos comparados. Incluye eventos con
relatedTarget en otra rama shadow y observa ambos extremos. Las relaciones,
owners y capacidades de hosts terminan en cero. Heap/RSS: 2,64/19,98 MiB en
rustdom, 3,82/94,63 MiB en Vitest y 3,45/99,82 MiB en VM. RSS incluye retención
del allocator; este estrés finito no demuestra ausencia absoluta de fugas.

## Benchmarks

`../benchmarks/2026-09-13T01-07-08.857Z-linux-x64.json` conserva 18 muestras
por motor y workload, sin otros runners locales simultáneos. Dos cadenas
shadow separadas se preparan antes del timer. Se crean y despachan 100
MouseEvents reales; los listeners comprueban target y relatedTarget. Se
verifican conteos y hashes del documento y de cada ShadowRoot fuera del timer.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Consultar raíces shadow 1.000 veces | 25 niveles | 2,762 | 1,991 | 1,39× |
| Consultar raíces shadow 1.000 veces | 100 niveles | 9,807 | 5,331 | 1,84× |
| Crear 100 hosts con ShadowRoot | 25 filas base | 6,637 | 6,743 | 0,98× |
| Crear/despachar 100 eventos entre ramas | 10 niveles por rama | 13,948 | 8,556 | 1,63× |
| Crear/despachar 100 eventos entre ramas | 30 niveles por rama | 162,407 | 25,261 | 6,43× |

Ratio = mediana jsdom / mediana rustdom. Son patrones sintéticos específicos,
no una mejora universal ni una medición causal contra el commit previo. La
creación de hosts queda aproximadamente en paridad en esta ejecución.

La entrega de eventos y listeners, los slots y las conversiones WebIDL siguen
pendientes de migración. Este hito no completa el objetivo integral.

## Distribución

El archivo instalable con SHA-256
`0f19c6f223acf85dd0a668689f2d50c65938c4d56587e4f982fe184a3f19c7e4`
pasó **18 controles en Node 24.14.1 y 18 en Node 22.12.0**, instalando con npm
y pnpm fuera del checkout. Los consumidores CJS/ESM verifican también la API
nativa y eventos compuestos de una ShadowRoot cerrada. Informes:
`../distribution/2026-09-13T01-08-56.839Z-linux-x64.json` y
`../distribution/2026-09-13T01-10-54.714Z-linux-x64.json`.
