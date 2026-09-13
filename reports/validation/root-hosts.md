# Relaciones de host y recorridos nativos

Rust conserva las relaciones numéricas de roots de ShadowRoot/templates y un
índice inverso por host. Liberar cualquiera de los extremos retira sus enlaces.
Se reutilizan CompactMap/CompactSet, extraídos del almacenamiento de atributos
sin cambiar su política de compactación ni sus pruebas de tombstones.

La proyección de tipo protege los roles al inicializar o reemplazar metadata:
roots son DocumentFragment y hosts son Element. Se permite registrar handles
reservados durante los constructores, con validación previa a la activación.
Las consultas están acotadas para rechazar ciclos de combinaciones nativas
inválidas sin quedar en un loop infinito.

DocumentFragment comparte un setter privado para las dos rutas originales de
asignación de host: constructor y reemplazo de contenido de template por el
parser. La referencia de objeto queda en un campo visible a V8; los mapas Rust
contienen únicamente IDs. No se crea una referencia fuerte inversa en JS que
retenga contenidos de template obsoletos.

shadowIncludingRoot y las ascendencias shadow/host consultan Rust. Las raíces
compuestas cruzan solo ShadowRoot; el control de ciclos incluye también hosts
de templates. Se conservan el orden de errores y los drivers de efectos. El
retargeting y la asignación de slots mantienen sus drivers restantes.

Pasaron cinco tests Rust de hosts, los cuatro de almacenamiento compacto,
Clippy y 51 contratos DOM existentes. Los seis tests nuevos cubren tres rutas
de parsing, raíces anidadas, adopción, eventos compuestos, retargeting, entradas
nativas inválidas y GC real.

El [control focal de GC](../memory/2026-09-12T23-48-18.844Z-root-hosts.json)
observó 503 documentos, 252 ventanas, 752 roots, 752 hosts y 250 nodos. La raíz
inicial que reemplaza parse5 desapareció mientras el template siguió vivo
(2 relaciones a 1); al terminar todos los scopes, relaciones, owners y capacidades
volvieron a cero. Conservar una ShadowRoot mantuvo su host vivo en el control
negativo, y ambos se recolectaron después de soltarla.

El [estrés general ampliado](../memory/2026-09-12T23-53-40.056Z-linux-x64.json)
pasó en cinco modos, incluyendo documentos inertes: rustdom liberó 1.322
documentos y 882 ventanas observados; cada modo Vitest liberó 1.320 documentos
y 880 ventanas. Los deltas de heap/RSS fueron 2,66/18,44 MiB en rustdom,
3,93/94,87 MiB en Vitest normal y 3,54/41,83 MiB en VM. Son controles finitos;
no demuestran ausencia absoluta de toda fuga.

El helper de almacenamiento conserva sus 221 líneas al pasar de un nombre
específico de atributos a `compact_storage.rs`. El registro de hosts es una
responsabilidad nueva; no se presenta esta ampliación como reducción total
de código.

La validación integral pasó **135 tests Rust, 478 contratos Node, 7 Jest,
18 Vitest y 26 en pools VM**, además de 1.784 casos HTML5 comparables. El
[reporte WPT](../compatibility/2026-09-13T00-07-46.070Z-linux-wpt.json) conserva
43.708 casos en paridad: 42.678 aprobados por el estándar y 1.030 fallos
compartidos. El bootstrap bloqueado de Range-deleteContents sigue declarado.

El [Memcheck completo](../memory/2026-09-13T00-00-53.011Z-valgrind.json) pasó
135 tests en 403,43 segundos, con cero errores y cero pérdidas definitivas
o indirectas. Los 48 bytes posibles y 544 alcanzables de std/libtest quedan
visibles en el log, sin supresiones.

El paquete con SHA-256
`f51995807964b44509eeffb365e0d7fbbec4b1b5a9e9c3037871c03f24f055d1`
pasó **18 controles** en [Node 24](../distribution/2026-09-13T00-08-55.694Z-linux-x64.json)
y **18 en Node 22.12** [en este reporte](../distribution/2026-09-13T00-09-15.202Z-linux-x64.json),
con instalaciones npm/pnpm y consumidores CJS/ESM reales.

## Rendimiento

El [benchmark de hosts y raíces](../benchmarks/2026-09-13T00-15-22.498Z-linux-x64.json)
se ejecutó sin otros runners locales. Las consultas preparan roots anidados
antes del timer; la creación incluye attachShadow e innerHTML. Se verifican
identidades, conectividad y hashes que incluyen el contenido y modo de cada
ShadowRoot, además del documento normal. Se preservan todas las muestras.

| Operación | Tamaño | jsdom ms | rustdom ms | Ratio |
|---|---:|---:|---:|---:|
| Construcción | 25 filas | 10,044 | 9,958 | 1,01× |
| Construcción | 250 filas | 28,391 | 36,175 | 0,78× |
| Construcción | 1.000 filas | 73,312 | 99,482 | 0,74× |
| Raíces poco profundas, 1.000 consultas | 250 filas | 0,791 | 1,208 | 0,66× |
| Raíces profundas, 1.000 consultas | 250 niveles | 16,652 | 7,479 | 2,23× |
| Raíces poco profundas, 1.000 consultas | 1.000 filas | 0,671 | 1,004 | 0,67× |
| Raíces profundas, 1.000 consultas | 1.000 niveles | 64,234 | 28,307 | 2,27× |
| Raíces shadow, 1.000 consultas | 25 niveles | 2,982 | 2,310 | 1,29× |
| Raíces shadow, 1.000 consultas | 100 niveles | 10,874 | 5,819 | 1,87× |
| Crear hosts con ShadowRoot y contenido | 100 hosts | 7,275 | 7,384 | 0,99× |

El ratio divide tiempo jsdom por tiempo rustdom. Los recorridos profundos
mejoran en estos patrones y la creación de hosts queda cerca de la paridad;
construcción grande y consultas cortas conservan costos pendientes. No es una
medición causal contra el commit anterior ni una mejora universal del DOM.
